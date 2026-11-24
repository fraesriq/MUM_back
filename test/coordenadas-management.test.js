const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const express = require('express');
const { createCoordenadasRepository } = require('../src/modules/coordenadas/coordenadas.repository');
const { createCoordenadasService, toCoordenadaDto } = require('../src/modules/coordenadas/coordenadas.service');
const { createCoordenadasController } = require('../src/modules/coordenadas/coordenadas.controller');
const { createCoordenadasRouter } = require('../src/modules/coordenadas/coordenadas.routes');
const { createCoordenadaSchema, updateCoordenadaSchema, paginationQuerySchema } = require('../src/modules/coordenadas/coordenadas.validation');

const valid = { latitud: -33.456789, longitud: -70.654321 };
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
  app.use(createCoordenadasRouter({ dataController: createCoordenadasController({ dataService: service }) }));
  app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }));
  const server = http.createServer(app); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await run(server.address().port); } finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

test('el router exige catalog:write para todas las operaciones y aplica paginación', { concurrency: false }, async () => {
  const calls = [];
  const service = {
    getAll: async (query) => { calls.push(query); return { items: [], total: 0, ...query }; }, getById: async (id) => ({ id_coordenada: id }),
    create: async (data) => ({ id_coordenada: 1, ...data }), update: async (id, data) => ({ id_coordenada: id, ...data }), remove: async () => ({ deleted: true }),
  };
  await withServer(service, async (port) => {
    for (const [method, path, body] of [['GET', '/', undefined], ['GET', '/1', undefined], ['POST', '/', valid], ['PUT', '/1', { confirmada: true }], ['DELETE', '/1', undefined]]) assert.equal((await request(port, method, path, body)).status, 403);
    assert.deepEqual((await request(port, 'GET', '/?page=2&limit=3', undefined, 'catalog:write')).body, { items: [], total: 0, page: 2, limit: 3 });
    assert.deepEqual(calls, [{ page: 2, limit: 3 }]);
    const created = await request(port, 'POST', '/', valid, 'catalog:write');
    assert.equal(created.status, 201); assert.equal(created.body.confirmada, false);
    assert.equal((await request(port, 'PUT', '/0', { confirmada: true }, 'catalog:write')).status, 400);
    assert.deepEqual((await request(port, 'DELETE', '/1', undefined, 'catalog:write')).body, { deleted: true });
  });
});

test('la validación restringe precisión, límites, URL y actualización vacía', () => {
  assert.deepEqual(createCoordenadaSchema.parse({ ...valid, url_mapa: null }), { ...valid, url_mapa: null, confirmada: false });
  assert.deepEqual(paginationQuerySchema.parse({}), { page: 1, limit: 20 });
  for (const value of [{ ...valid, latitud: -90.0000001 }, { ...valid, longitud: 180.0000001 }, { ...valid, latitud: 1.12345678 }, { ...valid, url_mapa: 'ftp://example.com' }, { ...valid, url_mapa: 'nota' }, { ...valid, url_mapa: 'https://x.test/' + 'a'.repeat(1010) }, { ...valid, confirmada: 1 }, { ...valid, extra: true }]) assert.equal(createCoordenadaSchema.safeParse(value).success, false);
  for (const query of [{ page: '0' }, { limit: '101' }, { page: '1.5' }]) assert.equal(paginationQuerySchema.safeParse(query).success, false);
  assert.equal(updateCoordenadaSchema.safeParse({}).success, false);
});

test('el repositorio usa SQL parametrizado, ordenado y campos permitidos', async () => {
  const queries = [];
  const repository = createCoordenadasRepository({ db: { query: async (sql, params) => {
    queries.push({ sql, params }); if (sql.startsWith('SELECT COUNT')) return [[{ total: 1 }]]; if (sql.startsWith('INSERT')) return [{ insertId: 4 }]; if (sql.startsWith('DELETE')) return [{ affectedRows: 1 }]; return [[{ id_coordenada: 4, ...valid, url_mapa: null, confirmada: 0 }]];
  } } });
  assert.deepEqual(await repository.findAll({ page: 2, limit: 10 }), { items: [{ id_coordenada: 4, ...valid, url_mapa: null, confirmada: 0 }], total: 1, page: 2, limit: 10 });
  await repository.create({ ...valid, url_mapa: null, confirmada: false }); await repository.update(4, { confirmada: true }); assert.equal(await repository.remove(4), true);
  await assert.rejects(() => repository.update(4, {}), /al menos un campo/);
  assert.match(queries[1].sql, /ORDER BY id_coordenada ASC LIMIT \? OFFSET \?$/); assert.deepEqual(queries[1].params, [10, 10]);
  assert.match(queries[2].sql, /^INSERT INTO coordenada .* VALUES \(\?, \?, \?, \?\)$/); assert.deepEqual(queries[2].params, [-33.456789, -70.654321, null, false]);
  assert.match(queries[4].sql, /^UPDATE coordenada SET confirmada = \? WHERE id_coordenada = \?$/); assert.deepEqual(queries[4].params, [true, 4]);
  assert.deepEqual(queries[6].params, [4]);
});

test('el servicio normaliza DTO, devuelve 404 y traduce FK sin SQL', async () => {
  const row = { id_coordenada: 1, latitud: '-33.4567890', longitud: '-70.6543210', url_mapa: null, confirmada: 1 };
  assert.deepEqual(toCoordenadaDto(row), { id_coordenada: 1, latitud: -33.456789, longitud: -70.654321, url_mapa: null, confirmada: true });
  const service = createCoordenadasService({ dataRepository: { findAll: async () => ({ items: [row], total: 1, page: 1, limit: 20 }), findById: async () => row, create: async () => row, update: async () => row, remove: async () => true } });
  assert.deepEqual(await service.getAll({ page: 1, limit: 20 }), { items: [toCoordenadaDto(row)], total: 1, page: 1, limit: 20 });
  await assert.rejects(() => createCoordenadasService({ dataRepository: { findById: async () => null } }).getById(9), { status: 404, message: 'Coordenada no encontrada' });
  await assert.rejects(() => createCoordenadasService({ dataRepository: { findById: async () => row, update: async () => null } }).update(1, { confirmada: true }), { status: 404, message: 'Coordenada no encontrada' });
  await assert.rejects(() => createCoordenadasService({ dataRepository: { remove: async () => false } }).remove(9), { status: 404, message: 'Coordenada no encontrada' });
  await assert.rejects(() => createCoordenadasService({ dataRepository: { remove: async () => { throw { code: 'ER_ROW_IS_REFERENCED_2', message: 'private SQL' }; } } }).remove(1), { status: 409, message: 'No se puede eliminar la coordenada porque tiene dependencias.' });
});

test('el router raíz monta coordenadas bajo la versión de API', () => {
  const source = require('node:fs').readFileSync(require.resolve('../src/routes/index'), 'utf8');
  assert.match(source, /router\.use\('\/coordenadas', coordenadasRoutes\)/);
});
