const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const express = require('express');
const { createContenidoSchema, updateContenidoSchema, listQuerySchema: contenidosQuerySchema } = require('../src/modules/contenidos/contenidos.validation');
const { createGaleriaSchema, updateGaleriaSchema, listQuerySchema: galeriaQuerySchema } = require('../src/modules/galeria/galeria.validation');
const { requireScope } = require('../src/auth/application.middleware');
const db = require('../src/config/database');
const contenidosRouter = require('../src/modules/contenidos/contenidos.routes');
const galeriaRouter = require('../src/modules/galeria/galeria.routes');
const galeriaService = require('../src/modules/galeria/galeria.service');
const galeriaRepository = require('../src/modules/galeria/galeria.repository');

const paginationFailures = ['0', '-1', '1.5', 'abc'];

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function request(port, method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: '127.0.0.1',
      port,
      method,
      path,
      headers: payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : undefined,
    }, (res) => {
      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(responseBody) }));
    });
    req.once('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function withCatalogRouter(router, query, run) {
  const originalQuery = db.query;
  let server;
  db.query = query;
  try {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.application = { scopes: ['catalog:read'] };
      next();
    });
    app.use(router);
    server = http.createServer(app);
    await listen(server);
    return await run(server.address().port);
  } finally {
    db.query = originalQuery;
    if (server) await close(server);
  }
}

test('GET /contenidos/aprobados usa contenido y filtra aprobados para catalog:read', { concurrency: false }, async () => {
  const queries = [];
  await withCatalogRouter(contenidosRouter, async (sql) => {
    queries.push(sql);
    return sql.includes('COUNT(*)') ? [[{ total: 0 }]] : [[]];
  }, async (port) => {
    const response = await request(port, 'GET', '/aprobados');
    assert.equal(response.status, 200);
  });
  assert.ok(queries.some((sql) => sql.includes('FROM contenido') && sql.includes("estado = 'aprobado'")));
});

test('GET /galeria usa archivo y filtra visibilidad pública para catalog:read', { concurrency: false }, async () => {
  const queries = [];
  await withCatalogRouter(galeriaRouter, async (sql) => {
    queries.push(sql);
    return sql.includes('COUNT(*)') ? [[{ total: 0 }]] : [[]];
  }, async (port) => {
    const response = await request(port, 'GET', '/');
    assert.equal(response.status, 200);
  });
  assert.ok(queries.some((sql) => sql.includes('FROM archivo')
    && sql.includes("permiso = 'autorizado'")
    && sql.includes('en_galeria_general = 1')));
});

test('POST de catálogo con solo catalog:read rechaza antes de consultar la base de datos', { concurrency: false }, async () => {
  for (const [router, body] of [
    [contenidosRouter, { seccion: 'inicio', titulo: 'Título', texto: 'Texto', orden: 0 }],
    [galeriaRouter, { tipo: 'foto', titulo: 'Foto', ruta: '/foto.jpg', texto_alt: 'Foto de prueba', credito: 'MUM' }],
  ]) {
    let queryCount = 0;
    await withCatalogRouter(router, async () => {
      queryCount += 1;
      throw new Error('No debe consultar la base de datos');
    }, async (port) => {
      const response = await request(port, 'POST', '/', body);
      assert.equal(response.status, 403);
      assert.equal(response.body.error, 'insufficient_scope');
    });
    assert.equal(queryCount, 0);
  }
});

test('la actualización de galería valida una fila de gestión sin enviar sus metadatos al repositorio', { concurrency: false }, async () => {
  const originalFindByIdForManagement = galeriaRepository.findByIdForManagement;
  const originalUpdate = galeriaRepository.update;
  const row = {
    id_archivo: 7,
    id_fuente: null,
    tipo: 'foto',
    titulo: 'Título original',
    ruta: '/foto.jpg',
    texto_alt: 'Descripción original',
    credito: 'MUM',
    permiso: 'autorizado',
    en_galeria_general: 1,
    orden_galeria: 2,
  };
  const patch = { titulo: 'Título actualizado' };
  let receivedPatch;
  try {
    galeriaRepository.findByIdForManagement = async () => row;
    galeriaRepository.update = async (id, data) => {
      assert.equal(id, row.id_archivo);
      receivedPatch = data;
      return { ...row, ...data };
    };

    const result = await galeriaService.update(row.id_archivo, patch);
    assert.equal(result.titulo, patch.titulo);
    assert.deepEqual(receivedPatch, patch);
  } finally {
    galeriaRepository.findByIdForManagement = originalFindByIdForManagement;
    galeriaRepository.update = originalUpdate;
  }
});

test('las actualizaciones de contenido no agregan estado predeterminado', () => {
  const result = updateContenidoSchema.safeParse({ titulo: 'Título corregido' });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { titulo: 'Título corregido' });
  assert.equal(updateContenidoSchema.safeParse({}).success, false);
  assert.equal(createContenidoSchema.safeParse({ seccion: 'inicio', titulo: 'Título', texto: 'Texto', orden: 0 }).data.estado, 'pendiente');
});

test('las actualizaciones de galería no agregan permiso ni visibilidad predeterminados', () => {
  const result = updateGaleriaSchema.safeParse({ titulo: 'Imagen corregida' });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { titulo: 'Imagen corregida' });
  assert.equal(updateGaleriaSchema.safeParse({}).success, false);
  const created = createGaleriaSchema.safeParse({ tipo: 'video', titulo: 'Video', ruta: '/video.mp4', credito: 'Archivo MUM' });
  assert.equal(created.success, true);
  assert.equal(created.data.permiso, 'pendiente');
  assert.equal(created.data.en_galeria_general, false);
});

for (const [name, schema] of [['contenido', contenidosQuerySchema], ['galería', galeriaQuerySchema]]) {
  test(`la paginación de ${name} acepta los valores predeterminados`, () => {
    assert.deepEqual(schema.parse({}), { page: 1, limit: 20 });
  });

  for (const value of paginationFailures) {
    test(`la paginación de ${name} rechaza page=${value}`, () => {
      assert.equal(schema.safeParse({ page: value }).success, false);
    });
    test(`la paginación de ${name} rechaza limit=${value}`, () => {
      assert.equal(schema.safeParse({ limit: value }).success, false);
    });
  }

  test(`la paginación de ${name} rechaza limit=101`, () => {
    assert.equal(schema.safeParse({ limit: '101' }).success, false);
  });
}

test('la validación de galería respeta las restricciones de archivo', () => {
  const base = { titulo: 'Archivo', ruta: '/archivo.jpg', credito: 'Archivo MUM' };
  assert.equal(createGaleriaSchema.safeParse({ ...base, tipo: 'foto' }).success, false);
  assert.equal(createGaleriaSchema.safeParse({ ...base, tipo: 'foto', texto_alt: 'Descripción' }).success, true);
  assert.equal(createGaleriaSchema.safeParse({ ...base, tipo: 'video' }).success, true);
  assert.equal(createGaleriaSchema.safeParse({ ...base, tipo: 'video', ruta: '   ' }).success, false);
  assert.equal(createGaleriaSchema.safeParse({ ...base, tipo: 'video', credito: '   ' }).success, false);
});

test('catalog:write permite solo clientes con el permiso de gestión', () => {
  const middleware = requireScope('catalog:write');
  const allowed = { application: { scopes: ['catalog:read', 'catalog:write'] } };
  let advanced = false;
  middleware(allowed, {}, () => { advanced = true; });
  assert.equal(advanced, true);

  const denied = { application: { scopes: ['catalog:read'] } };
  const response = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  middleware(denied, response, assert.fail);
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error, 'insufficient_scope');
});
