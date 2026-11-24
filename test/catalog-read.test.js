const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const express = require('express');
const { createFuentesRepository } = require('../src/modules/fuentes/fuentes.repository');
const { createFuentesService } = require('../src/modules/fuentes/fuentes.service');
const { createGeografiaRepository } = require('../src/modules/geografia/geografia.repository');
const { createGeografiaService } = require('../src/modules/geografia/geografia.service');
const { createGeografiaController } = require('../src/modules/geografia/geografia.controller');
const { createFuentesRouter } = require('../src/modules/fuentes/fuentes.routes');
const { createGeografiaRouter } = require('../src/modules/geografia/geografia.routes');
const { requireScope } = require('../src/auth/application.middleware');
const routes = require('../src/routes');

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); });
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function request(port, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
    });
    req.once('error', reject);
    req.end();
  });
}

test('el repositorio de fuentes usa la proyección segura exacta y ordena por título', async () => {
  const queries = [];
  const repository = createFuentesRepository({
    db: { query: async (sql, params) => { queries.push({ sql, params }); return [[]]; } },
  });

  await repository.findAll();
  await repository.findById(7);

  assert.match(queries[0].sql, /^SELECT id_fuente, titulo, tipo, autor_institucion, url, verificada FROM fuente ORDER BY titulo ASC$/);
  assert.doesNotMatch(queries[0].sql, /archivo_original/);
  assert.match(queries[1].sql, /^SELECT id_fuente, titulo, tipo, autor_institucion, url, verificada FROM fuente WHERE id_fuente = \?$/);
  assert.deepEqual(queries[1].params, [7]);
});

test('el servicio de fuentes limita el DTO seguro y convierte verificada en booleano', async () => {
  const service = createFuentesService({
    dataRepository: { findAll: async () => [{ id_fuente: 1, titulo: 'Fuente', tipo: 'web', autor_institucion: null, url: null, verificada: 1, archivo_original: 'privado.pdf' }] },
  });

  assert.deepEqual(await service.getAll(), [{ id_fuente: 1, titulo: 'Fuente', tipo: 'web', autor_institucion: null, url: null, verificada: true }]);
});

test('el repositorio geográfico ordena y filtra padres con SQL parametrizado', async () => {
  const queries = [];
  const repository = createGeografiaRepository({
    db: { query: async (sql, params) => { queries.push({ sql, params }); return [[]]; } },
  });

  await repository.findRegiones();
  await repository.findRegionById(3);
  await repository.findProvinciasByRegionId(3);
  await repository.findProvinciaById(9);
  await repository.findComunasByProvinciaId(9);

  assert.match(queries[0].sql, /FROM region ORDER BY nombre ASC$/);
  assert.match(queries[1].sql, /WHERE id_region = \?$/);
  assert.deepEqual(queries[1].params, [3]);
  assert.match(queries[2].sql, /WHERE id_region = \? ORDER BY nombre ASC$/);
  assert.deepEqual(queries[2].params, [3]);
  assert.match(queries[3].sql, /WHERE id_provincia = \?$/);
  assert.deepEqual(queries[3].params, [9]);
  assert.match(queries[4].sql, /WHERE id_provincia = \? ORDER BY nombre ASC$/);
  assert.deepEqual(queries[4].params, [9]);
});

test('el servicio geográfico distingue padre inexistente de colección hija vacía', async () => {
  const calls = [];
  const service = createGeografiaService({
    dataRepository: {
      findRegiones: async () => [],
      findRegionById: async (id) => id === 1 ? { id_region: id } : null,
      findProvinciasByRegionId: async (id) => { calls.push(['provincias', id]); return []; },
      findProvinciaById: async (id) => id === 2 ? { id_provincia: id } : null,
      findComunasByProvinciaId: async (id) => { calls.push(['comunas', id]); return []; },
    },
  });

  assert.equal(await service.getProvinciasByRegionId(99), null);
  assert.equal(await service.getComunasByProvinciaId(99), null);
  assert.deepEqual(await service.getProvinciasByRegionId(1), []);
  assert.deepEqual(await service.getComunasByProvinciaId(2), []);
  assert.deepEqual(calls, [['provincias', 1], ['comunas', 2]]);
});

test('las colecciones geográficas responden 404 para padres ausentes y 200 vacía para padres existentes', { concurrency: false }, async () => {
  let server;
  try {
    const controller = createGeografiaController({
      dataService: {
        getRegiones: async () => [],
        getProvinciasByRegionId: async (id) => id === 1 ? null : [],
        getComunasByProvinciaId: async (id) => id === 1 ? null : [],
      },
    });
    const app = express();
    app.use('/', createGeografiaRouter({ dataController: controller }));
    server = http.createServer(app);
    await listen(server);
    const port = server.address().port;
    assert.equal((await request(port, '/regiones/1/provincias')).status, 404);
    assert.deepEqual((await request(port, '/regiones/2/provincias')).body, []);
    assert.equal((await request(port, '/provincias/1/comunas')).status, 404);
    assert.deepEqual((await request(port, '/provincias/2/comunas')).body, []);
  } finally {
    if (server) await close(server);
  }
});

test('los IDs inválidos responden 400 antes de acceder a los controladores', { concurrency: false }, async () => {
  let server;
  let calls = 0;
  const controller = {
    getAll: (req, res) => res.json([]),
    getById: () => { calls += 1; },
    create: () => { calls += 1; },
    update: () => { calls += 1; },
    remove: () => { calls += 1; },
    getRegiones: (req, res) => res.json([]),
    getProvinciasByRegionId: () => { calls += 1; },
    getComunasByProvinciaId: () => { calls += 1; },
    getRegionById: () => { calls += 1; },
    createRegion: () => { calls += 1; },
    updateRegion: () => { calls += 1; },
    removeRegion: () => { calls += 1; },
    getProvinciaById: () => { calls += 1; },
    createProvincia: () => { calls += 1; },
    updateProvincia: () => { calls += 1; },
    removeProvincia: () => { calls += 1; },
    getComunaById: () => { calls += 1; },
    createComuna: () => { calls += 1; },
    updateComuna: () => { calls += 1; },
    removeComuna: () => { calls += 1; },
  };
  try {
    const app = express();
    app.use('/fuentes', createFuentesRouter({ dataController: controller }));
    app.use('/', createGeografiaRouter({ dataController: controller }));
    server = http.createServer(app);
    await listen(server);
    const port = server.address().port;
    for (const path of ['/fuentes/0', '/fuentes/-1', '/regiones/1.5/provincias', '/provincias/abc/comunas']) {
      assert.equal((await request(port, path)).status, 400);
    }
    assert.equal(calls, 0);
  } finally {
    if (server) await close(server);
  }
});

test('las nuevas rutas conservan el gate raíz catalog:read heredado', { concurrency: false }, async () => {
  let server;
  try {
    const app = express();
    app.use('/api/v1', (req, res, next) => { req.application = { scopes: req.get('x-test-scope')?.split(' ') || [] }; next(); }, requireScope('catalog:read'), routes);
    app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }));
    server = http.createServer(app);
    await listen(server);
    const port = server.address().port;
    assert.equal((await request(port, '/api/v1/fuentes/0', { 'x-test-scope': 'catalog:write' })).status, 400);
    const denied = await request(port, '/api/v1/fuentes/0');
    assert.equal(denied.status, 403);
    assert.equal(denied.body.error, 'insufficient_scope');
  } finally {
    if (server) await close(server);
  }
});
