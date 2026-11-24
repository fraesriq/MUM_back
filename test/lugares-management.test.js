const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const express = require('express');
const { createLugaresRepository } = require('../src/modules/lugares/lugares.repository');
const { createLugaresService } = require('../src/modules/lugares/lugares.service');
const { createLugaresController } = require('../src/modules/lugares/lugares.controller');
const { createLugaresRouter } = require('../src/modules/lugares/lugares.routes');
const { createLugarSchema, updateLugarSchema, approvalLugarSchema, managementQuerySchema } = require('../src/modules/lugares/lugares.validation');

const valid = { id_comuna: 1, slug: 'quebrada-verde', nombre: 'Quebrada Verde', descripcion: 'Descripción válida' };
function request(port, method, path, body, scope = 'catalog:read') {
  return new Promise((resolve, reject) => {
    const payload = body && JSON.stringify(body);
    const req = http.request({ host: '127.0.0.1', port, method, path, headers: { 'x-test-scope': scope, ...(payload && { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }) } }, (res) => {
      let data = ''; res.on('data', (chunk) => { data += chunk; }); res.on('end', () => resolve({ status: res.statusCode, body: data && JSON.parse(data) }));
    });
    req.once('error', reject); if (payload) req.write(payload); req.end();
  });
}
async function withServer(service, run) {
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { req.application = { scopes: req.get('x-test-scope')?.split(' ') || [] }; next(); });
  app.use(createLugaresRouter({ dataController: createLugaresController({ dataService: service }) }));
  app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }));
  const server = http.createServer(app); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await run(server.address().port); } finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

test('gestión precede al slug, exige escritura y conserva las rutas públicas', { concurrency: false }, async () => {
  const calls = [];
  const service = {
    getAll: async () => [{ slug: 'quebrada-verde' }], getBySlug: async (slug) => ({ slug }),
    getManagementAll: async (filters) => { calls.push(filters); return { items: [], total: 0, ...filters }; },
    getManagementById: async (id) => ({ id_lugar: id }), create: async (data) => ({ ...data, estado: 'pendiente' }), update: async (id, data) => ({ id_lugar: id, ...data }),
    approve: async (id, estado) => ({ id_lugar: id, estado }), remove: async () => ({ deleted: true }),
  };
  await withServer(service, async (port) => {
    assert.equal((await request(port, 'GET', '/gestion')).status, 403);
    assert.equal((await request(port, 'GET', '/gestion', undefined, 'catalog:write')).status, 200);
    assert.deepEqual(calls, [{ page: 1, limit: 20 }]);
    assert.equal((await request(port, 'GET', '/gestion/7')).status, 403);
    assert.deepEqual((await request(port, 'GET', '/gestion/7', undefined, 'catalog:write')).body, { id_lugar: 7 });
    assert.deepEqual((await request(port, 'GET', '/quebrada-verde')).body, { slug: 'quebrada-verde' });
    assert.equal((await request(port, 'POST', '/', valid)).status, 403);
    const created = await request(port, 'POST', '/', valid, 'catalog:write');
    assert.equal(created.status, 201); assert.equal(created.body.estado, 'pendiente');
    assert.equal((await request(port, 'PUT', '/0', { nombre: 'Otro' }, 'catalog:write')).status, 400);
    assert.equal((await request(port, 'GET', '/gestion/1.5', undefined, 'catalog:write')).status, 400);
    assert.equal((await request(port, 'PATCH', '/7/aprobar', { estado: 'aprobado' })).status, 403);
    assert.deepEqual((await request(port, 'PATCH', '/7/aprobar', { estado: 'rechazado' }, 'catalog:write')).body, { id_lugar: 7, estado: 'rechazado' });
    assert.equal((await request(port, 'PATCH', '/7/aprobar', { estado: 'pendiente' }, 'catalog:write')).status, 400);
    assert.equal((await request(port, 'PATCH', '/0/aprobar', { estado: 'aprobado' }, 'catalog:write')).status, 400);
    assert.equal((await request(port, 'DELETE', '/7')).status, 403);
    assert.deepEqual((await request(port, 'DELETE', '/7', undefined, 'catalog:write')).body, { deleted: true });
  });
});

test('validación restringe campos, límites, filtros y actualizaciones vacías', () => {
  assert.deepEqual(createLugarSchema.parse({ ...valid, id_coordenada: null, id_fuente: null }), { ...valid, id_coordenada: null, id_fuente: null, orden: 1 });
  for (const value of [{ ...valid, estado: 'aprobado' }, { ...valid, slug: 'Quebrada' }, { ...valid, nombre: ' ' }, { ...valid, descripcion: ' ' }, { ...valid, id_comuna: Number.MAX_SAFE_INTEGER + 1 }, { ...valid, orden: 65536 }]) assert.equal(createLugarSchema.safeParse(value).success, false);
  assert.equal(updateLugarSchema.safeParse({}).success, false);
  assert.equal(updateLugarSchema.safeParse({ estado: 'aprobado' }).success, false);
  assert.deepEqual(approvalLugarSchema.parse({ estado: 'aprobado' }), { estado: 'aprobado' });
  for (const value of [{ estado: 'pendiente' }, { estado: 'aprobado', nombre: 'Lugar' }, {}]) assert.equal(approvalLugarSchema.safeParse(value).success, false);
  assert.equal(updateLugarSchema.safeParse({ id_coordenada: null }).success, true);
  assert.equal(createLugarSchema.safeParse({ ...valid, slug: `a-${'a'.repeat(178)}`, nombre: 'a'.repeat(150), descripcion: 'a'.repeat(10000), orden: 0 }).success, true);
  for (const query of [{ page: '0' }, { limit: '101' }, { comuna_id: '1.1' }, { estado: 'otro' }]) assert.equal(managementQuerySchema.safeParse(query).success, false);
  assert.deepEqual(managementQuerySchema.parse({ estado: 'pendiente', comuna_id: '2' }), { page: 1, limit: 20, estado: 'pendiente', comuna_id: 2 });
});

test('repositorio usa parámetros, orden estable, estado pendiente y actualización permitida', async () => {
  const queries = [];
  const repository = createLugaresRepository({ db: { query: async (sql, params) => {
    queries.push({ sql, params }); if (sql.startsWith('SELECT COUNT')) return [[{ total: 1 }]]; if (sql.startsWith('INSERT')) return [{ insertId: 7 }]; if (sql.startsWith('UPDATE') || sql.startsWith('DELETE')) return [{ affectedRows: 1 }]; return [[{ id_lugar: 7 }]];
  } } });
  assert.deepEqual(await repository.findManagementAll({ page: 2, limit: 10, estado: 'pendiente', comuna_id: 3 }), { items: [{ id_lugar: 7 }], total: 1, page: 2, limit: 10 });
  assert.deepEqual(queries[0].params, ['pendiente', 3]);
  assert.match(queries[1].sql, /ORDER BY id_lugar ASC LIMIT \? OFFSET \?$/); assert.deepEqual(queries[1].params, ['pendiente', 3, 10, 10]);
  await repository.create({ ...valid, orden: 1 }); await repository.update(7, { id_coordenada: null });
  assert.match(queries[2].sql, /estado\) VALUES .*'pendiente'/); assert.deepEqual(queries[4].params, [null, 7]);
  assert.equal(await repository.setEstado(7, 'aprobado'), true); assert.equal(await repository.remove(7), true);
  assert.match(queries[6].sql, /^UPDATE lugar SET estado = \? WHERE id_lugar = \?$/); assert.deepEqual(queries[6].params, ['aprobado', 7]);
  assert.match(queries[7].sql, /^DELETE FROM lugar WHERE id_lugar = \?$/); assert.deepEqual(queries[7].params, [7]);
  await assert.rejects(() => repository.update(7, {}), /al menos un campo/);
});

test('servicio aísla la lectura pública y traduce ausencia y conflictos sin SQL', async () => {
  const publicService = createLugaresService({ dataRepository: { findAll: async () => [{ id_lugar: 1, id_comuna: 2, estado: 'aprobado', slug: 'quebrada-verde', coordenada_confirmada: false, latitud: 1, longitud: 2, url_mapa: 'private' }], findBySlug: async () => ({ slug: 'quebrada-verde', coordenada_confirmada: false, archivos: [] }) }, filesService: { mapPublicFiles: async () => [] } });
  assert.deepEqual(await publicService.getAll(), [{ slug: 'quebrada-verde', latitud: null, longitud: null, url_mapa: null }]);
  const absent = createLugaresService({ dataRepository: { findManagementById: async () => null } });
  await assert.rejects(() => absent.getManagementById(9), { status: 404, message: 'Lugar no encontrado' });
  await assert.rejects(() => absent.update(9, { nombre: 'Lugar' }), { status: 404, message: 'Lugar no encontrado' });
  for (const code of ['ER_DUP_ENTRY', 'ER_NO_REFERENCED_ROW_2']) {
    const failure = async () => { throw { code, message: 'private SQL' }; };
    const service = createLugaresService({ dataRepository: { create: failure, findManagementById: async () => ({ id_lugar: 1 }), update: failure } });
    await assert.rejects(() => service.create(valid), { status: 409 });
    await assert.rejects(() => service.update(1, { slug: 'otro-lugar' }), { status: 409 });
  }
  const lifecycleAbsent = createLugaresService({ dataRepository: { findManagementById: async () => null, remove: async () => false } });
  await assert.rejects(() => lifecycleAbsent.approve(9, 'aprobado'), { status: 404, message: 'Lugar no encontrado' });
  await assert.rejects(() => lifecycleAbsent.remove(9), { status: 404, message: 'Lugar no encontrado' });
  const lifecycle = createLugaresService({ dataRepository: { findManagementById: async () => ({ id_lugar: 1, estado: 'pendiente' }), setEstado: async () => true } });
  assert.deepEqual(await lifecycle.approve(1, 'rechazado'), { id_lugar: 1, estado: 'rechazado' });
  const dependent = createLugaresService({ dataRepository: { remove: async () => { throw { code: 'ER_ROW_IS_REFERENCED_2', message: 'private SQL' }; } } });
  await assert.rejects(() => dependent.remove(1), { status: 409, message: 'No se puede eliminar el lugar porque tiene dependencias.' });
});
