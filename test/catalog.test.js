const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const test = require('node:test');
const express = require('express');
const { createR2Config } = require('../src/config/r2');
const { createR2Service } = require('../src/storage/r2.service');
const { createArchivosService } = require('../src/modules/archivos/archivos.service');
const { createArchivosRepository } = require('../src/modules/archivos/archivos.repository');
const { createGaleriaService } = require('../src/modules/galeria/galeria.service');
const { createEspeciesService } = require('../src/modules/especies/especies.service');
const { createLugaresService } = require('../src/modules/lugares/lugares.service');
const { createLugaresRepository } = require('../src/modules/lugares/lugares.repository');
const { createArchivoSchema, updateArchivoSchema, listQuerySchema: archivosQuerySchema } = require('../src/modules/archivos/archivos.validation');
const { listQuerySchema: galeriaQuerySchema } = require('../src/modules/galeria/galeria.validation');
const { createContenidoSchema, updateContenidoSchema } = require('../src/modules/contenidos/contenidos.validation');
const { requireScope } = require('../src/auth/application.middleware');
const archivosRouter = require('../src/modules/archivos/archivos.routes');
const galeriaRouter = require('../src/modules/galeria/galeria.routes');
const contenidosRouter = require('../src/modules/contenidos/contenidos.routes');
const routes = require('../src/routes');

const env = {
  R2_ACCOUNT_ID: 'account-test', R2_ACCESS_KEY_ID: 'access-test', R2_SECRET_ACCESS_KEY: 'secret-test', R2_BUCKET_NAME: 'bucket-test',
  R2_SIGNED_UPLOAD_TTL_SECONDS: '300', R2_SIGNED_DOWNLOAD_TTL_SECONDS: '3600', R2_MAX_FILE_SIZE_BYTES: '10485760',
};
const metadata = { tipo: 'foto', titulo: 'Archivo', texto_alt: 'Descripción', credito: 'MUM', permiso: 'autorizado', en_galeria_general: true };
const key = 'archivos/foto/2026/11/123e4567-e89b-12d3-a456-426614174000.jpg';

function fakeConfig() { return createR2Config(env); }
function fakeR2(overrides = {}) { return { createPresignedUpload: async () => 'https://put.test', createPresignedDownload: async (fileKey) => `https://get.test/${fileKey}`, headObject: async () => ({ ContentType: 'image/jpeg', ContentLength: 10 }), deleteObject: async () => {}, ...overrides }; }
function grant(overrides = {}) { return { object_key: key, application_public_id: 'client-admin', tipo: 'foto', content_type: 'image/jpeg', size_bytes: 10, expires_at: new Date(Date.now() + 60000), confirmed_at: null, ...overrides }; }
function fakeRepository(overrides = {}) { return { findAll: async () => ({ items: [], total: 0, page: 1, limit: 20 }), findById: async () => null, findByRuta: async () => null, findPublicGallery: async () => ({ items: [], total: 0, page: 1, limit: 20 }), findPublicGalleryById: async () => null, create: async (item) => item, createUploadGrant: async () => {}, findUploadGrant: async () => grant(), insertWithGrantConfirmation: async ({ objectKey, metadata }) => ({ state: 'created', item: { ...metadata, ruta: objectKey } }), recordCleanupTask: async () => true, completeCleanupTask: async () => true, listPendingCleanupTasks: async () => [], update: async (id, item) => ({ id_archivo: id, ...item }), deleteWithCleanup: async () => null, ...overrides }; }

function listen(server) { return new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); }); }); }
function close(server) { return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))); }
function request(port, method, path, body, headers = {}) { return new Promise((resolve, reject) => { const payload = body && JSON.stringify(body); const req = http.request({ host: '127.0.0.1', port, method, path, headers: { ...headers, ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}) } }, (res) => { let data = ''; res.on('data', (chunk) => { data += chunk; }); res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null })); }); req.once('error', reject); if (payload) req.write(payload); req.end(); }); }

test('la configuración R2 valida de forma diferida y construye endpoint y TTL seguros', () => {
  const lazyMissing = createR2Config({});
  assert.throws(lazyMissing, /R2_ACCOUNT_ID/);
  const config = fakeConfig()();
  assert.equal(config.endpoint, 'https://account-test.r2.cloudflarestorage.com');
  assert.equal(config.region, 'auto');
  assert.equal(config.signedUploadTtlSeconds, 300);
  assert.equal(config.signedDownloadTtlSeconds, 3600);
  assert.throws(createR2Config({ ...env, R2_SIGNED_UPLOAD_TTL_SECONDS: '0' }), /entero positivo/);
  const bounded = createR2Config({ ...env, R2_SIGNED_UPLOAD_TTL_SECONDS: '1', R2_SIGNED_DOWNLOAD_TTL_SECONDS: '604800' })();
  assert.equal(bounded.signedUploadTtlSeconds, 1);
  assert.equal(bounded.signedDownloadTtlSeconds, 604800);
  assert.throws(createR2Config({ ...env, R2_SIGNED_UPLOAD_TTL_SECONDS: '604801' }), /entero positivo/);
});

test('el servicio R2 firma PUT y GET con bucket, clave, contenido y TTL correctos', async () => {
  const calls = [];
  class Command { constructor(input) { this.input = input; } }
  const service = createR2Service({
    getConfig: fakeConfig(), clientFactory: () => ({ send: async () => ({}) }),
    signer: async (client, command, options) => { calls.push({ client, command, options }); return 'https://signed.test'; },
    commands: { PutObjectCommand: Command, GetObjectCommand: Command, HeadObjectCommand: Command, DeleteObjectCommand: Command },
  });
  assert.equal(await service.createPresignedUpload({ key, contentType: 'image/jpeg', contentLength: 10 }), 'https://signed.test');
  assert.equal(await service.createPresignedDownload(key), 'https://signed.test');
  assert.deepEqual(calls[0].command.input, { Bucket: 'bucket-test', Key: key, ContentType: 'image/jpeg', ContentLength: 10 });
  assert.equal(calls[0].options.expiresIn, 300);
  assert.deepEqual([...calls[0].options.signableHeaders].sort(), ['content-length', 'content-type']);
  assert.deepEqual(calls[1].command.input, { Bucket: 'bucket-test', Key: key });
  assert.equal(calls[1].options.expiresIn, 3600);
});

test('la firma AWS local incluye content-type y content-length', async () => {
  const url = await createR2Service({ getConfig: fakeConfig() }).createPresignedUpload({ key, contentType: 'image/jpeg', contentLength: 10 });
  const signedHeaders = new URL(url).searchParams.get('X-Amz-SignedHeaders').split(';');
  assert.ok(signedHeaders.includes('content-type'));
  assert.ok(signedHeaders.includes('content-length'));
});

test('la solicitud de carga rechaza MIME incompatible y tamaño excedido antes de firmar', async () => {
  let signed = false;
  const service = createArchivosService({ repository: fakeRepository(), getR2Config: fakeConfig(), r2Service: fakeR2({ createPresignedUpload: async () => { signed = true; } }), createUuid: () => '123e4567-e89b-12d3-a456-426614174000' });
  await assert.rejects(() => service.requestUpload({ tipo: 'foto', content_type: 'video/mp4', tamanio_bytes: 10, application_client_id: 'client-admin' }), /no es compatible/);
  await assert.rejects(() => service.requestUpload({ tipo: 'foto', content_type: 'image/jpeg', tamanio_bytes: 10485761, application_client_id: 'client-admin' }), /supera/);
  assert.equal(signed, false);
});

test('la solicitud de carga registra el vínculo de aplicación y firma el tamaño declarado', async () => {
  const grants = [];
  let signedInput;
  const service = createArchivosService({ repository: fakeRepository({ createUploadGrant: async (value) => { grants.push(value); } }), getR2Config: fakeConfig(), r2Service: fakeR2({ createPresignedUpload: async (value) => { signedInput = value; return 'https://put.test'; } }), createUuid: () => '123e4567-e89b-12d3-a456-426614174000' });
  const result = await service.requestUpload({ tipo: 'foto', content_type: 'image/jpeg', tamanio_bytes: 10, application_client_id: 'client-admin' });
  assert.equal(grants[0].applicationClientId, 'client-admin');
  assert.deepEqual(signedInput, { key: result.object_key, contentType: 'image/jpeg', contentLength: 10 });
  assert.deepEqual(result.required_headers, { 'Content-Type': 'image/jpeg' });
  assert.deepEqual(result.signed_headers, ['content-type', 'content-length']);
  assert.equal(result.expected_size_bytes, 10);
});

test('la autorización y la tarea durable se confirman antes de entregar la URL', async () => {
  const events = [];
  const service = createArchivosService({ repository: fakeRepository({ createUploadGrant: async () => { events.push('durable'); } }), getR2Config: fakeConfig(), r2Service: fakeR2({ createPresignedUpload: async () => { events.push('signed'); return 'https://put.test'; } }), createUuid: () => '123e4567-e89b-12d3-a456-426614174000' });
  await service.requestUpload({ tipo: 'foto', content_type: 'image/jpeg', tamanio_bytes: 10, application_client_id: 'client-admin' });
  assert.deepEqual(events, ['durable', 'signed']);
});

test('el repositorio crea autorización y tarea, y completa la tarea al confirmar en la misma transacción', async () => {
  const queries = [];
  const connection = {
    beginTransaction: async () => queries.push('begin'), commit: async () => queries.push('commit'), rollback: async () => queries.push('rollback'), release: () => queries.push('release'),
    query: async (sql) => {
      queries.push(sql);
      if (sql.startsWith('SELECT object_key')) return [[grant()]];
      if (sql.includes('SELECT id_archivo') && sql.includes('FOR UPDATE')) return [[]];
      if (sql.startsWith('INSERT INTO archivo')) return [{ insertId: 8 }];
      if (sql.startsWith('SELECT id_archivo')) return [[{ id_archivo: 8, ...metadata, ruta: key }]];
      return [{}];
    },
  };
  const repository = createArchivosRepository({ db: { getConnection: async () => connection }, now: () => new Date() });
  await repository.createUploadGrant({ objectKey: key, applicationClientId: 'client-admin', tipo: 'foto', contentType: 'image/jpeg', size: 10, expiresAt: new Date(Date.now() + 60000) });
  assert.ok(queries.some((sql) => sql.includes('r2_cleanup_tasks')));
  assert.ok(queries.some((sql) => sql.includes('r2_upload_grants')));
  queries.length = 0;
  await repository.insertWithGrantConfirmation({ objectKey: key, applicationClientId: 'client-admin', tipo: 'foto', contentType: 'image/jpeg', size: 10, metadata });
  const grantUpdate = queries.findIndex((sql) => sql.startsWith('UPDATE r2_upload_grants'));
  const cleanupDelete = queries.findIndex((sql) => sql.startsWith('DELETE FROM r2_cleanup_tasks'));
  assert.ok(grantUpdate >= 0 && cleanupDelete > grantUpdate);
  assert.ok(queries.includes('commit'));
});

test('la confirmación rechaza claves no administradas y discrepancias antes de insertar', async () => {
  let inserts = 0;
  const repository = fakeRepository({ create: async () => { inserts += 1; } });
  const service = createArchivosService({ repository, getR2Config: fakeConfig(), r2Service: fakeR2() });
  await assert.rejects(() => service.confirmUpload({ ...metadata, object_key: 'externo.jpg', content_type: 'image/jpeg', tamanio_bytes: 10, application_client_id: 'client-admin' }), /espacio administrado/);
  await assert.rejects(() => createArchivosService({ repository, getR2Config: fakeConfig(), r2Service: fakeR2({ headObject: async () => ({ ContentType: 'image/png', ContentLength: 10 }) }) }).confirmUpload({ ...metadata, object_key: key, content_type: 'image/jpeg', tamanio_bytes: 10, application_client_id: 'client-admin' }), /contenido almacenado/);
  await assert.rejects(() => createArchivosService({ repository, getR2Config: fakeConfig(), r2Service: fakeR2({ headObject: async () => ({ ContentType: 'image/jpeg', ContentLength: 9 }) }) }).confirmUpload({ ...metadata, object_key: key, content_type: 'image/jpeg', tamanio_bytes: 10, application_client_id: 'client-admin' }), /tamaño almacenado/);
  assert.equal(inserts, 0);
});

test('la confirmación inserta metadatos solamente después de verificar el objeto', async () => {
  const events = [];
  const service = createArchivosService({ repository: fakeRepository({ insertWithGrantConfirmation: async ({ objectKey, metadata: item }) => { events.push('insert'); return { state: 'created', item: { ...item, ruta: objectKey } }; } }), getR2Config: fakeConfig(), r2Service: fakeR2({ headObject: async () => { events.push('head'); return { ContentType: 'image/jpeg', ContentLength: 10 }; } }) });
  const result = await service.confirmUpload({ ...metadata, object_key: key, content_type: 'image/jpeg', tamanio_bytes: 10, application_client_id: 'client-admin' });
  assert.deepEqual(events, ['head', 'insert']);
  assert.equal(result.ruta, key);
});

test('la confirmación repetida devuelve el archivo confirmado sin insertar ni consultar R2', async () => {
  let headed = false;
  const existing = { id_archivo: 4, ...metadata, ruta: key };
  const service = createArchivosService({ repository: fakeRepository({ findUploadGrant: async () => grant({ confirmed_at: new Date() }), findByRuta: async () => existing, insertWithGrantConfirmation: assert.fail }), getR2Config: fakeConfig(), r2Service: fakeR2({ headObject: async () => { headed = true; } }) });
  assert.equal(await service.confirmUpload({ ...metadata, object_key: key, content_type: 'image/jpeg', tamanio_bytes: 10, application_client_id: 'client-admin' }), existing);
  assert.equal(headed, false);
});

test('la confirmación rechaza una autorización emitida para otra aplicación', async () => {
  const service = createArchivosService({ repository: fakeRepository(), getR2Config: fakeConfig(), r2Service: fakeR2() });
  await assert.rejects(() => service.confirmUpload({ ...metadata, object_key: key, content_type: 'image/jpeg', tamanio_bytes: 10, application_client_id: 'client-no-autorizado' }), { message: /no pertenece/, status: 403 });
});

test('un fallo de inserción elimina el objeto o conserva una tarea de limpieza', async () => {
  let deleted = 0;
  const service = createArchivosService({ repository: fakeRepository({ insertWithGrantConfirmation: async () => { throw new Error('fallo de base de datos'); } }), getR2Config: fakeConfig(), r2Service: fakeR2({ deleteObject: async () => { deleted += 1; } }) });
  await assert.rejects(() => service.confirmUpload({ ...metadata, object_key: key, content_type: 'image/jpeg', tamanio_bytes: 10, application_client_id: 'client-admin' }), /objeto cargado fue eliminado/);
  assert.equal(deleted, 1);

  const tasks = [];
  const failedCleanup = createArchivosService({ repository: fakeRepository({ insertWithGrantConfirmation: async () => { throw new Error('fallo de base de datos'); }, recordCleanupTask: async (task) => { tasks.push(task); return true; } }), getR2Config: fakeConfig(), r2Service: fakeR2({ deleteObject: async () => { throw new Error('R2 no disponible'); } }) });
  await assert.rejects(() => failedCleanup.confirmUpload({ ...metadata, object_key: key, content_type: 'image/jpeg', tamanio_bytes: 10, application_client_id: 'client-admin' }), /pendiente de limpieza/);
  assert.equal(tasks[0].objectKey, key);
});

test('el fallo triple de confirmación informa que la tarea preexistente requiere revisión', async () => {
  const service = createArchivosService({ repository: fakeRepository({ insertWithGrantConfirmation: async () => { throw new Error('fallo de base de datos'); }, recordCleanupTask: async () => { throw new Error('fallo al actualizar tarea'); } }), getR2Config: fakeConfig(), r2Service: fakeR2({ deleteObject: async () => { throw new Error('R2 no disponible'); } }) });
  await assert.rejects(() => service.confirmUpload({ ...metadata, object_key: key, content_type: 'image/jpeg', tamanio_bytes: 10, application_client_id: 'client-admin' }), { message: /tarea de limpieza preexistente/, status: 503 });
});

test('la eliminación no llama R2 cuando la transacción de base de datos falla', async () => {
  let r2Calls = 0;
  const service = createArchivosService({ repository: fakeRepository({ deleteWithCleanup: async () => { throw new Error('restricción de clave foránea'); } }), getR2Config: fakeConfig(), r2Service: fakeR2({ deleteObject: async () => { r2Calls += 1; } }) });
  await assert.rejects(() => service.remove(7), /clave foránea/);
  assert.equal(r2Calls, 0);
});

test('la eliminación conserva o completa la tarea durable según R2', async () => {
  const item = { id_archivo: 7, ruta: key };
  const retained = [];
  const failed = createArchivosService({ repository: fakeRepository({ deleteWithCleanup: async () => item, recordCleanupTask: async (task) => { retained.push(task); return true; } }), getR2Config: fakeConfig(), r2Service: fakeR2({ deleteObject: async () => { throw new Error('R2 no disponible'); } }) });
  await assert.rejects(() => failed.remove(7), /pendiente de limpieza/);
  assert.equal(retained[0].objectKey, key);

  let completed;
  const succeeded = createArchivosService({ repository: fakeRepository({ deleteWithCleanup: async () => item, completeCleanupTask: async (objectKey) => { completed = objectKey; return true; } }), getR2Config: fakeConfig(), r2Service: fakeR2() });
  assert.deepEqual(await succeeded.remove(7), { deleted: true });
  assert.equal(completed, key);
});

test('el procesador de limpieza omite referencias actuales, elimina huérfanos y conserva fallos', async () => {
  const orphan = 'archivos/foto/2026/11/123e4567-e89b-12d3-a456-426614174001.jpg';
  const failedKey = 'archivos/foto/2026/11/123e4567-e89b-12d3-a456-426614174002.jpg';
  const deleted = [];
  const completed = [];
  const failures = [];
  const service = createArchivosService({
    repository: fakeRepository({
      listPendingCleanupTasks: async () => [{ object_key: orphan, reason: 'fallo_confirmacion' }, { object_key: failedKey, reason: 'archivo_eliminado' }],
      completeCleanupTask: async (objectKey) => { completed.push(objectKey); return true; },
      recordCleanupTask: async (task) => { failures.push(task); return true; },
    }),
    getR2Config: fakeConfig(),
    r2Service: fakeR2({ deleteObject: async (objectKey) => { deleted.push(objectKey); if (objectKey === failedKey) throw new Error('R2 no disponible'); } }),
  });
  const result = await service.processCleanup({ limit: 100 });
  assert.deepEqual(result, { processed: 2, deleted: 1, failed: 1 });
  assert.deepEqual(completed, [orphan]);
  assert.equal(failures[0].objectKey, failedKey);
  assert.equal(deleted.includes(key), false);
});

test('el contrato de candidatos de limpieza excluye grants activos sin confirmar sin mirar la razón', async () => {
  let sql;
  const repository = createArchivosRepository({ db: { query: async (statement) => { sql = statement; return [[]]; } } });
  await repository.listPendingCleanupTasks(100);
  assert.match(sql, /a\.id_archivo IS NULL/);
  assert.match(sql, /g\.object_key IS NULL OR g\.confirmed_at IS NOT NULL OR g\.expires_at < CURRENT_TIMESTAMP/);
  assert.doesNotMatch(sql.slice(sql.indexOf('WHERE')), /t\.reason/);
  assert.ok(sql.includes('g.confirmed_at IS NOT NULL'), 'un grant confirmado sin archivo es candidato');
  assert.ok(sql.includes('g.expires_at < CURRENT_TIMESTAMP'), 'un grant sin confirmar vencido es candidato');
  assert.ok(sql.includes('g.object_key IS NULL'), 'una clave sin grant es candidata');
});

test('el rollback durable declara las precondiciones de seguridad', () => {
  const migration = fs.readFileSync(path.join(__dirname, '..', 'migrations', '20261121_archivo_r2_durability.down.sql'), 'utf8');
  assert.match(migration, /DETENER/);
  assert.match(migration, /r2_cleanup_tasks/);
  assert.match(migration, /confirmed_at IS NULL/);
});

test('la migración durable usa claves ASCII binarias y el rollback restaura ruta utf8mb4', () => {
  const migrationsPath = path.join(__dirname, '..', 'migrations');
  const up = fs.readFileSync(path.join(migrationsPath, '20261121_archivo_r2_durability.up.sql'), 'utf8');
  const down = fs.readFileSync(path.join(migrationsPath, '20261121_archivo_r2_durability.down.sql'), 'utf8');
  assert.match(up, /SELECT ruta FROM archivo WHERE ruta REGEXP '\[\^\[:ascii:\]\]'/);
  assert.match(up, /MODIFY COLUMN ruta VARCHAR\(1024\) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,\s+ADD UNIQUE KEY uq_archivo_ruta \(ruta\)/);
  assert.equal((up.match(/object_key VARCHAR\(1024\) CHARACTER SET ascii COLLATE ascii_bin NOT NULL/g) || []).length, 2);
  assert.equal((up.match(/PRIMARY KEY \(object_key\)/g) || []).length, 2);
  assert.match(down, /DROP TABLE r2_upload_grants;\s+DROP TABLE r2_cleanup_tasks;\s+ALTER TABLE archivo\s+DROP INDEX uq_archivo_ruta,\s+MODIFY COLUMN ruta VARCHAR\(1024\) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL/);
});

test('la proyección pública agrega URL firmada y elimina campos privados', async () => {
  const service = createArchivosService({ repository: fakeRepository({ findPublicGallery: async () => ({ items: [{ id_archivo: 1, ...metadata, ruta: key, id_fuente: 4 }], total: 1, page: 1, limit: 20 }) }), getR2Config: fakeConfig(), r2Service: fakeR2() });
  const result = await service.getPublicGallery({ page: 1, limit: 20 });
  assert.equal(result.items[0].url, `https://get.test/${key}`);
  assert.equal(result.items[0].url_expires_in, 3600);
  for (const field of ['ruta', 'permiso', 'id_fuente', 'en_galeria_general']) assert.equal(field in result.items[0], false);
});

test('galería delega la lectura pública al módulo archivos', async () => {
  const galeria = createGaleriaService({ service: { getPublicGallery: async (filters) => ({ filters }), getPublicGalleryById: async (id) => ({ id }) } });
  assert.deepEqual(await galeria.getAll({ page: 1 }), { filters: { page: 1 } });
  assert.deepEqual(await galeria.getById(7), { id: 7 });
});

test('el router de galería expone solo GET y POST devuelve 404', { concurrency: false }, async () => {
  let server;
  try {
    const app = express(); app.use(express.json()); app.use((req, res, next) => { req.application = { scopes: ['catalog:read'] }; next(); }); app.use(galeriaRouter); app.use((req, res) => res.status(404).json({ message: 'No encontrado' }));
    server = http.createServer(app); await listen(server);
    const invalidGet = await request(server.address().port, 'GET', '/?page=0');
    assert.equal(invalidGet.status, 400);
    const response = await request(server.address().port, 'POST', '/', metadata);
    assert.equal(response.status, 404);
  } finally { if (server) await close(server); }
});

test('la consulta validada de galería entrega paginación numérica al repositorio', { concurrency: false }, async () => {
  let server;
  const repository = require('../src/modules/archivos/archivos.repository');
  const original = repository.findPublicGallery;
  let received;
  repository.findPublicGallery = async (filters) => {
    received = filters;
    return { items: [], total: 0, ...filters };
  };
  try {
    const app = express();
    app.use(galeriaRouter);
    server = http.createServer(app); await listen(server);
    const response = await request(server.address().port, 'GET', '/?page=1&limit=20');
    assert.equal(response.status, 200);
    assert.deepEqual(received, { page: 1, limit: 20 });
    assert.equal(typeof received.page, 'number');
    assert.equal(typeof received.limit, 'number');
  } finally {
    repository.findPublicGallery = original;
    if (server) await close(server);
  }
});

test('las consultas validadas usan valores numéricos predeterminados y rechazan paginación inválida', { concurrency: false }, async () => {
  let server;
  const repository = require('../src/modules/archivos/archivos.repository');
  const original = repository.findPublicGallery;
  let received;
  repository.findPublicGallery = async (filters) => {
    received = filters;
    return { items: [], total: 0, ...filters };
  };
  try {
    const app = express();
    app.use(galeriaRouter);
    server = http.createServer(app); await listen(server);
    const port = server.address().port;
    const defaults = await request(port, 'GET', '/');
    assert.equal(defaults.status, 200);
    assert.deepEqual(received, { page: 1, limit: 20 });
    assert.equal(typeof received.page, 'number');
    assert.equal(typeof received.limit, 'number');
    const invalid = await request(port, 'GET', '/?page=0');
    assert.equal(invalid.status, 400);
  } finally {
    repository.findPublicGallery = original;
    if (server) await close(server);
  }
});

test('todos los controladores con validación de consulta consumen la consulta validada', { concurrency: false }, async () => {
  let server;
  const archivosService = require('../src/modules/archivos/archivos.service');
  const contenidosService = require('../src/modules/contenidos/contenidos.service');
  const galeriaService = require('../src/modules/galeria/galeria.service');
  const originals = {
    archivos: archivosService.getAll,
    aprobados: contenidosService.getAprobados,
    contenidos: contenidosService.getAll,
    galeria: galeriaService.getAll,
  };
  const received = {};
  archivosService.getAll = async (filters) => { received.archivos = filters; return filters; };
  contenidosService.getAprobados = async (filters) => { received.aprobados = filters; return filters; };
  contenidosService.getAll = async (filters) => { received.contenidos = filters; return filters; };
  galeriaService.getAll = async (filters) => { received.galeria = filters; return filters; };
  try {
    const app = express();
    app.use((req, res, next) => { req.application = { scopes: ['catalog:write'] }; next(); });
    app.use('/archivos', archivosRouter);
    app.use('/contenidos', contenidosRouter);
    app.use('/galeria', galeriaRouter);
    server = http.createServer(app); await listen(server);
    const port = server.address().port;
    for (const path of ['/archivos?page=1&limit=20', '/contenidos/aprobados?page=1&limit=20', '/contenidos?page=1&limit=20', '/galeria?page=1&limit=20']) {
      assert.equal((await request(port, 'GET', path)).status, 200);
    }
    assert.deepEqual(Object.keys(received).sort(), ['aprobados', 'archivos', 'contenidos', 'galeria']);
    for (const filters of Object.values(received)) {
      assert.deepEqual(filters, { page: 1, limit: 20 });
      assert.equal(typeof filters.page, 'number');
      assert.equal(typeof filters.limit, 'number');
    }
  } finally {
    archivosService.getAll = originals.archivos;
    contenidosService.getAprobados = originals.aprobados;
    contenidosService.getAll = originals.contenidos;
    galeriaService.getAll = originals.galeria;
    if (server) await close(server);
  }
});

test('el repositorio de archivos entrega LIMIT y OFFSET como parámetros numéricos', async () => {
  const queries = [];
  const repository = createArchivosRepository({
    db: { query: async (sql, params) => {
      queries.push({ sql, params });
      return sql.startsWith('SELECT COUNT') ? [[{ total: 0 }]] : [[]];
    } },
  });
  await repository.findPublicGallery({ page: 1, limit: 20 });
  assert.match(queries[0].sql, /LIMIT \? OFFSET \?/);
  assert.deepEqual(queries[0].params, [20, 0]);
  assert.equal(queries[0].params.every((value) => typeof value === 'number'), true);
});

test('la aplicación configura exactamente un proxy de confianza', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'app.js'), 'utf8');
  assert.match(source, /const app = express\(\);\s*app\.set\('trust proxy', 1\);/);
  assert.doesNotMatch(source, /app\.set\('trust proxy', true\)/);
});

test('las mutaciones de archivos rechazan catalog:read antes de consultar dependencias', { concurrency: false }, async () => {
  let server;
  try {
    const app = express(); app.use(express.json()); app.use((req, res, next) => { req.application = { scopes: ['catalog:read'] }; next(); }); app.use(archivosRouter);
    server = http.createServer(app); await listen(server);
    const response = await request(server.address().port, 'POST', '/cargas', { tipo: 'foto', content_type: 'image/jpeg', tamanio_bytes: 10 });
    assert.equal(response.status, 403);
    assert.equal(response.body.error, 'insufficient_scope');
  } finally { if (server) await close(server); }
});

test('la pila de rutas permite catalog:write en archivos, pero conserva su guardia de escritura', { concurrency: false }, async () => {
  let server;
  try {
    const app = express();
    app.use('/api/v1', (req, res, next) => { req.application = { scopes: req.get('x-test-scope').split(' ') }; next(); }, requireScope('catalog:read'), routes);
    app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }));
    server = http.createServer(app); await listen(server);
    const port = server.address().port;
    const writeOnly = await request(port, 'GET', '/api/v1/archivos?page=0', undefined, { 'x-test-scope': 'catalog:write' });
    const readOnly = await request(port, 'GET', '/api/v1/archivos?page=0', undefined, { 'x-test-scope': 'catalog:read' });
    const catalogRead = await request(port, 'GET', '/api/v1/galeria?page=0', undefined, { 'x-test-scope': 'catalog:read' });
    assert.equal(writeOnly.status, 400);
    assert.equal(readOnly.status, 403);
    assert.equal(readOnly.body.error, 'insufficient_scope');
    assert.equal(catalogRead.status, 400);
  } finally { if (server) await close(server); }
});

test('especies y lugares firman archivos públicos y no exponen ruta', async () => {
  const filesService = { mapPublicFiles: async (files) => files.map(({ ruta, ...file }) => ({ ...file, url: `https://get.test/${ruta}`, url_expires_in: 3600 })) };
  const row = { slug: 'sector', archivos: [{ id_archivo: 1, ruta: key, tipo: 'foto' }] };
  const especie = await createEspeciesService({ dataRepository: { findAll: async () => [], findBySlug: async () => row }, filesService }).getBySlug('sector');
  const lugar = await createLugaresService({ dataRepository: { findAll: async () => [], findBySlug: async () => row }, filesService }).getBySlug('sector');
  assert.equal('ruta' in especie.archivos[0], false);
  assert.equal('ruta' in lugar.archivos[0], false);
  assert.equal(especie.archivos[0].url_expires_in, 3600);
});

test('el repositorio de lugares consulta la jerarquía comuna, provincia y región sin ciudad', async () => {
  const queries = [];
  const repository = createLugaresRepository({
    db: { query: async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes('FROM lugar_archivo')) return [[]];
      if (sql.includes('WHERE l.slug = ?')) return [[{ slug: 'costa', coordenada_confirmada: true }]];
      return [[]];
    } },
  });

  await repository.findAll();
  await repository.findBySlug('costa');

  const geographyQueries = queries.slice(0, 2);
  for (const { sql } of geographyQueries) {
    assert.match(sql, /JOIN comuna c ON c\.id_comuna = l\.id_comuna/);
    assert.match(sql, /JOIN provincia p ON p\.id_provincia = c\.id_provincia/);
    assert.match(sql, /JOIN region r ON r\.id_region = p\.id_region/);
    assert.match(sql, /c\.nombre AS comuna/);
    assert.match(sql, /p\.nombre AS provincia/);
    assert.match(sql, /r\.nombre AS region/);
    assert.doesNotMatch(sql, /\bciudad\b|id_ciudad/i);
  }
  assert.deepEqual(queries[1].params, ['costa']);
  assert.match(queries[2].sql, /a\.permiso = 'autorizado'/);
});

test('los DTO públicos de especies y lugares eliminan identificadores y estados internos', async () => {
  const filesService = { mapPublicFiles: async () => [] };
  const especie = await createEspeciesService({ dataRepository: { findAll: async () => [], findBySlug: async () => ({ id_especie: 1, id_categoria: 2, id_fuente: 3, estado: 'aprobado', slug: 'ave', archivos: [] }) }, filesService }).getBySlug('ave');
  const lugarService = createLugaresService({ dataRepository: { findAll: async () => [{ id_lugar: 1, id_comuna: 2, id_coordenada: 3, id_fuente: 4, estado: 'aprobado', coordenada_confirmada: false, slug: 'costa', comuna: 'Comuna', provincia: 'Provincia', region: 'Región', latitud: 1, longitud: 2, url_mapa: 'privado' }], findBySlug: async () => null }, filesService });
  const [lugar] = await lugarService.getAll();
  for (const field of ['id_especie', 'id_categoria', 'id_fuente', 'estado']) assert.equal(field in especie, false);
  for (const field of ['id_lugar', 'id_comuna', 'id_coordenada', 'id_fuente', 'estado', 'coordenada_confirmada']) assert.equal(field in lugar, false);
  assert.deepEqual({ comuna: lugar.comuna, provincia: lugar.provincia, region: lugar.region }, { comuna: 'Comuna', provincia: 'Provincia', region: 'Región' });
  assert.deepEqual({ latitud: lugar.latitud, longitud: lugar.longitud, url_mapa: lugar.url_mapa }, { latitud: null, longitud: null, url_mapa: null });
});

test('las actualizaciones de contenido no agregan estado predeterminado', () => {
  assert.deepEqual(updateContenidoSchema.parse({ titulo: 'Título corregido' }), { titulo: 'Título corregido' });
  assert.equal(updateContenidoSchema.safeParse({}).success, false);
  assert.equal(createContenidoSchema.parse({ seccion: 'inicio', titulo: 'Título', texto: 'Texto', orden: 0 }).estado, 'pendiente');
});

test('las actualizaciones de archivos no agregan permisos ni visibilidad predeterminados', () => {
  assert.deepEqual(updateArchivoSchema.parse({ titulo: 'Título corregido' }), { titulo: 'Título corregido' });
  assert.equal(updateArchivoSchema.safeParse({}).success, false);
  const created = createArchivoSchema.parse({ tipo: 'video', titulo: 'Video', credito: 'MUM' });
  assert.equal(created.permiso, 'pendiente');
  assert.equal(created.en_galeria_general, false);
});

for (const [name, schema] of [['archivos', archivosQuerySchema], ['galería', galeriaQuerySchema]]) {
  test(`la paginación de ${name} acepta valores predeterminados`, () => { assert.deepEqual(schema.parse({}), { page: 1, limit: 20 }); });
  for (const value of ['0', '-1', '1.5', 'abc']) {
    test(`la paginación de ${name} rechaza page=${value}`, () => { assert.equal(schema.safeParse({ page: value }).success, false); });
    test(`la paginación de ${name} rechaza limit=${value}`, () => { assert.equal(schema.safeParse({ limit: value }).success, false); });
  }
  test(`la paginación de ${name} rechaza limit=101`, () => { assert.equal(schema.safeParse({ limit: '101' }).success, false); });
}

test('la validación de archivos respeta las restricciones de metadatos', () => {
  assert.equal(createArchivoSchema.safeParse({ tipo: 'foto', titulo: 'Archivo', credito: 'MUM' }).success, false);
  assert.equal(createArchivoSchema.safeParse({ tipo: 'foto', titulo: 'Archivo', credito: 'MUM', texto_alt: 'Descripción' }).success, true);
  assert.equal(createArchivoSchema.safeParse({ tipo: 'video', titulo: 'Archivo', credito: 'MUM' }).success, true);
});

test('catalog:write hereda catalog:read sin otorgar escritura al permiso de lectura', () => {
  const readMiddleware = requireScope('catalog:read');
  const writeMiddleware = requireScope('catalog:write');
  let readAdvanced = false;
  readMiddleware({ application: { scopes: ['catalog:write'] } }, {}, () => { readAdvanced = true; });
  assert.equal(readAdvanced, true);
  let writeAdvanced = false;
  writeMiddleware({ application: { scopes: ['catalog:read', 'catalog:write'] } }, {}, () => { writeAdvanced = true; });
  assert.equal(writeAdvanced, true);
  const response = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  writeMiddleware({ application: { scopes: ['catalog:read'] } }, response, assert.fail);
  assert.equal(response.statusCode, 403);
  readMiddleware({ application: { scopes: ['other:write'] } }, response, assert.fail);
  assert.equal(response.statusCode, 403);
  readMiddleware({}, response, assert.fail);
  assert.equal(response.statusCode, 403);
  for (const scopes of [null, 'catalog:write', { 0: 'catalog:write' }, ['catalog:write', null]]) {
    assert.doesNotThrow(() => readMiddleware({ application: { scopes } }, response, assert.fail));
    assert.equal(response.statusCode, 403);
  }
  assert.doesNotThrow(() => requireScope('toString')({ application: { scopes: ['catalog:write'] } }, response, assert.fail));
  assert.equal(response.statusCode, 403);
});

test('la actualización valida la fila fusionada sin mutar tipo ni ruta', async () => {
  let received;
  const service = createArchivosService({
    repository: fakeRepository({ findById: async () => ({ id_archivo: 7, ...metadata, ruta: key }), update: async (id, patch) => { received = { id, patch }; return { id_archivo: id, ...patch }; } }),
    getR2Config: fakeConfig(), r2Service: fakeR2(),
  });
  await service.update(7, { titulo: 'Corregido' });
  assert.deepEqual(received, { id: 7, patch: { titulo: 'Corregido' } });
});
