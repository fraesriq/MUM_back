const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const express = require('express');
const { createGeografiaRepository } = require('../src/modules/geografia/geografia.repository');
const { createGeografiaService } = require('../src/modules/geografia/geografia.service');
const { createGeografiaController } = require('../src/modules/geografia/geografia.controller');
const { createGeografiaRouter } = require('../src/modules/geografia/geografia.routes');
const { regionSchema, provinciaSchema, updateRegionSchema, updateProvinciaSchema } = require('../src/modules/geografia/geografia.validation');

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
  app.use(createGeografiaRouter({ dataController: createGeografiaController({ dataService: service }) }));
  app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }));
  const server = http.createServer(app); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await run(server.address().port); } finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

test('la gestión exige catalog:write y las rutas anidadas no colisionan', { concurrency: false }, async () => {
  const calls = [];
  const service = {
    getRegiones: async () => [], getProvinciasByRegionId: async (id) => { calls.push(['nested', id]); return []; }, getComunasByProvinciaId: async (id) => { calls.push(['comunas', id]); return []; },
    getRegionById: async (id) => ({ id_region: id }), createRegion: async (data) => ({ id_region: 1, ...data }), updateRegion: async () => ({}), removeRegion: async () => ({ deleted: true }),
    getProvinciaById: async (id) => ({ id_provincia: id }), createProvincia: async (data) => ({ id_provincia: 1, ...data }), updateProvincia: async () => ({}), removeProvincia: async () => ({ deleted: true }),
  };
  await withServer(service, async (port) => {
    assert.equal((await request(port, 'GET', '/regiones')).status, 200);
    assert.equal((await request(port, 'GET', '/regiones/1')).status, 403);
    assert.equal((await request(port, 'POST', '/regiones', { nombre: ' Norte ' })).status, 403);
    assert.equal((await request(port, 'POST', '/regiones', { nombre: ' Norte ' }, 'catalog:write')).status, 201);
    assert.equal((await request(port, 'POST', '/provincias', { id_region: 1, nombre: ' Centro ' }, 'catalog:write')).status, 201);
    assert.deepEqual((await request(port, 'GET', '/regiones/7/provincias')).body, []);
    assert.deepEqual((await request(port, 'GET', '/provincias/8/comunas')).body, []);
    assert.deepEqual(calls, [['nested', 7], ['comunas', 8]]);
    assert.equal((await request(port, 'PUT', '/provincias/1', {}, 'catalog:write')).status, 400);
  });
});

test('la validación normaliza nombres y rechaza campos inválidos o actualizaciones vacías', () => {
  assert.deepEqual(regionSchema.parse({ nombre: ' Norte ' }), { nombre: 'Norte' });
  assert.deepEqual(provinciaSchema.parse({ id_region: 1, nombre: ' Centro ' }), { id_region: 1, nombre: 'Centro' });
  for (const value of [{ nombre: ' ' }, { nombre: 'A' }, { nombre: 'a'.repeat(101) }, { nombre: 'Norte', otro: true }]) assert.equal(regionSchema.safeParse(value).success, false);
  for (const value of [{ id_region: 0, nombre: 'Centro' }, { id_region: 1.5, nombre: 'Centro' }, { id_region: '1', nombre: 'Centro' }]) assert.equal(provinciaSchema.safeParse(value).success, false);
  assert.equal(updateRegionSchema.safeParse({}).success, false);
  assert.equal(updateProvinciaSchema.safeParse({}).success, false);
});

test('el repositorio usa columnas permitidas, parámetros y orden determinista', async () => {
  const queries = [];
  const repository = createGeografiaRepository({ db: { query: async (sql, params) => {
    queries.push({ sql, params }); if (sql.startsWith('INSERT')) return [{ insertId: 4 }]; if (sql.startsWith('DELETE')) return [{ affectedRows: 1 }]; return [[{ id_region: 1, id_provincia: 4, nombre: 'Centro' }]];
  } } });
  await repository.findRegiones(); await repository.createRegion({ nombre: 'Norte' }); await repository.updateRegion(1, { nombre: 'Sur' }); await repository.removeRegion(1);
  await repository.createProvincia({ id_region: 1, nombre: 'Centro' }); await repository.updateProvincia(4, { nombre: 'Centro sur' }); await repository.removeProvincia(4);
  await assert.rejects(() => repository.updateProvincia(4, {}), /al menos un campo/);
  assert.match(queries[0].sql, /ORDER BY nombre ASC$/); assert.deepEqual(queries[1].params, ['Norte']); assert.deepEqual(queries[3].params, ['Sur', 1]);
  assert.deepEqual(queries[6].params, [1, 'Centro']); assert.deepEqual(queries[10].params, [4]);
});

test('el servicio entrega 404 y conflictos 409 sin filtrar SQL', async () => {
  const absent = createGeografiaService({ dataRepository: { findRegionById: async () => null, findProvinciaById: async () => null, removeRegion: async () => false, removeProvincia: async () => false } });
  await assert.rejects(() => absent.getRegionById(1), { status: 404 }); await assert.rejects(() => absent.removeProvincia(1), { status: 404 });
  await assert.rejects(() => absent.createProvincia({ id_region: 9, nombre: 'Centro' }), { status: 409, message: 'La región indicada no existe.' });
  const race = createGeografiaService({ dataRepository: { findRegionById: async () => ({ id_region: 1 }), findProvinciaById: async () => ({ id_provincia: 2 }), createProvincia: async () => { throw { code: 'ER_NO_REFERENCED_ROW', message: 'private SQL' }; }, updateProvincia: async () => { throw { code: 'ER_NO_REFERENCED_ROW_2', message: 'private SQL' }; } } });
  await assert.rejects(() => race.createProvincia({ id_region: 1, nombre: 'Centro' }), { status: 409, message: 'La región indicada no existe.' });
  await assert.rejects(() => race.updateProvincia(2, { id_region: 1 }), { status: 409, message: 'La región indicada no existe.' });
  const duplicate = createGeografiaService({ dataRepository: { createRegion: async () => { throw { code: 'ER_DUP_ENTRY', message: 'private SQL' }; } } });
  await assert.rejects(() => duplicate.createRegion({ nombre: 'Norte' }), { status: 409, message: 'Ya existe una región con ese nombre.' });
  const dependent = createGeografiaService({ dataRepository: { removeRegion: async () => { throw { code: 'ER_ROW_IS_REFERENCED_2', message: 'private SQL' }; } } });
  await assert.rejects(() => dependent.removeRegion(1), { status: 409, message: 'No se puede eliminar la región porque tiene provincias dependientes.' });
});
