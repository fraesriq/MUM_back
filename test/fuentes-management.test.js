const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const express = require('express');
const { createFuentesRepository } = require('../src/modules/fuentes/fuentes.repository');
const { createFuentesService } = require('../src/modules/fuentes/fuentes.service');
const { createFuentesController } = require('../src/modules/fuentes/fuentes.controller');
const { createFuentesRouter } = require('../src/modules/fuentes/fuentes.routes');
const { createFuenteSchema, updateFuenteSchema } = require('../src/modules/fuentes/fuentes.validation');

const valid = { titulo: 'Fuente institucional', tipo: 'institucion' };
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
  app.use(createFuentesRouter({ dataController: createFuentesController({ dataService: service }) }));
  app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }));
  const server = http.createServer(app); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await run(server.address().port); } finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

test('las escrituras de fuentes exigen catalog:write y las lecturas se conservan', { concurrency: false }, async () => {
  const calls = [];
  const service = {
    getAll: async () => [], getById: async (id) => ({ id_fuente: id }),
    create: async (data) => { calls.push(data); return { id_fuente: 3, ...data }; }, update: async (id, data) => ({ id_fuente: id, ...data }), remove: async () => ({ deleted: true }),
  };
  await withServer(service, async (port) => {
    assert.equal((await request(port, 'GET', '/')).status, 200);
    assert.equal((await request(port, 'POST', '/', valid)).status, 403);
    const created = await request(port, 'POST', '/', valid, 'catalog:write');
    assert.equal(created.status, 201); assert.equal(created.body.verificada, false);
    assert.deepEqual(calls, [{ ...valid, autor_institucion: null, archivo_original: null, url: null, verificada: false }]);
    assert.equal((await request(port, 'PUT', '/3', {} , 'catalog:write')).status, 400);
    assert.deepEqual((await request(port, 'DELETE', '/3', undefined, 'catalog:write')).body, { deleted: true });
  });
});

test('la validación es estricta, respeta límites y normaliza valores', () => {
  assert.deepEqual(createFuenteSchema.parse({ titulo: ' Fuente ', tipo: 'web', autor_institucion: null, archivo_original: ' informe.pdf ', url: 'https://example.com', verificada: true }), { titulo: 'Fuente', tipo: 'web', autor_institucion: null, archivo_original: 'informe.pdf', url: 'https://example.com', verificada: true });
  for (const value of [{ ...valid, titulo: ' ' }, { ...valid, tipo: 'libro' }, { ...valid, url: 'ftp://example.com' }, { ...valid, archivo_original: ' ' }, { ...valid, verificada: 1 }, { ...valid, extra: true }, { titulo: 'a'.repeat(256), tipo: 'web' }, { ...valid, autor_institucion: 'a'.repeat(201) }, { ...valid, archivo_original: 'a'.repeat(501) }]) assert.equal(createFuenteSchema.safeParse(value).success, false);
  assert.equal(updateFuenteSchema.safeParse({}).success, false);
  assert.equal(updateFuenteSchema.safeParse({ desconocido: true }).success, false);
});

test('el repositorio parametriza CRUD, conserva el orden y proyecta datos seguros', async () => {
  const queries = [];
  const repository = createFuentesRepository({ db: { query: async (sql, params) => {
    queries.push({ sql, params }); if (sql.startsWith('INSERT')) return [{ insertId: 4 }]; if (sql.startsWith('DELETE')) return [{ affectedRows: 1 }]; return [[{ id_fuente: 4, ...valid, autor_institucion: null, url: null, verificada: 0, archivo_original: 'privado.pdf' }]];
  } } });
  await repository.findAll(); await repository.findById(4); await repository.create({ ...valid, autor_institucion: null, archivo_original: null, url: null, verificada: false }); await repository.update(4, { verificada: true }); await repository.remove(4);
  await assert.rejects(() => repository.update(4, {}), /al menos un campo/);
  assert.match(queries[0].sql, /ORDER BY titulo ASC$/); assert.doesNotMatch(queries[0].sql, /archivo_original/);
  assert.match(queries[2].sql, /^INSERT INTO fuente .* VALUES \(\?, \?, \?, \?, \?, \?\)$/); assert.deepEqual(queries[2].params, ['Fuente institucional', 'institucion', null, null, null, false]);
  assert.deepEqual(queries[4].params, [true, 4]); assert.deepEqual(queries[6].params, [4]);
});

test('el servicio responde DTO seguro, 404 y 409 sin filtrar SQL', async () => {
  const row = { id_fuente: 1, ...valid, autor_institucion: null, url: null, verificada: 1, archivo_original: 'privado.pdf' };
  const service = createFuentesService({ dataRepository: { findAll: async () => [], findById: async () => row, create: async () => row, update: async () => row, remove: async () => true } });
  assert.deepEqual(await service.create(valid), { id_fuente: 1, titulo: 'Fuente institucional', tipo: 'institucion', autor_institucion: null, url: null, verificada: true });
  assert.deepEqual(await service.update(1, { verificada: false }), { id_fuente: 1, titulo: 'Fuente institucional', tipo: 'institucion', autor_institucion: null, url: null, verificada: true });
  const absent = createFuentesService({ dataRepository: { findById: async () => null, remove: async () => false } });
  await assert.rejects(() => absent.getById(9), { status: 404, message: 'Fuente no encontrada' }); await assert.rejects(() => absent.remove(9), { status: 404, message: 'Fuente no encontrada' });
  const deletedDuringUpdate = createFuentesService({ dataRepository: { findById: async () => row, update: async () => null } });
  await assert.rejects(() => deletedDuringUpdate.update(1, { verificada: false }), { status: 404, message: 'Fuente no encontrada' });
  const dependent = createFuentesService({ dataRepository: { remove: async () => { throw { code: 'ER_ROW_IS_REFERENCED_2', message: 'private SQL' }; } } });
  await assert.rejects(() => dependent.remove(1), { status: 409, message: 'No se puede eliminar la fuente porque tiene dependencias.' });
});
