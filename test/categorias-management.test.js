const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const express = require('express');
const { createCategoriasRepository } = require('../src/modules/categorias/categorias.repository');
const { createCategoriasService } = require('../src/modules/categorias/categorias.service');
const { createCategoriasController } = require('../src/modules/categorias/categorias.controller');
const { createCategoriasRouter } = require('../src/modules/categorias/categorias.routes');
const { createCategoriaSchema, updateCategoriaSchema } = require('../src/modules/categorias/categorias.validation');
const { requireScope } = require('../src/auth/application.middleware');

function request(port, method, path, body, scope = 'catalog:read') {
  return new Promise((resolve, reject) => {
    const payload = body && JSON.stringify(body);
    const req = http.request({ host: '127.0.0.1', port, method, path, headers: {
      'x-test-scope': scope,
      ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
    } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
    });
    req.once('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function withServer(service, run) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.application = { scopes: req.get('x-test-scope')?.split(' ') || [] }; next(); });
  app.use(requireScope('catalog:read'));
  app.use(createCategoriasRouter({ dataController: createCategoriasController({ dataService: service }) }));
  app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }));
  const server = http.createServer(app);
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', (error) => error ? reject(error) : resolve()));
  try { await run(server.address().port); } finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

test('las rutas conservan lectura pública y exigen catalog:write para gestionar categorías', { concurrency: false }, async () => {
  const calls = [];
  const service = {
    getAll: async () => [{ id_categoria: 1, nombre: 'Aves', slug: 'aves', orden: 1 }],
    getById: async (id) => ({ id_categoria: id }),
    create: async (data) => { calls.push(['create', data]); return { id_categoria: 2, ...data }; },
    update: async (id, data) => ({ id_categoria: id, ...data }),
    remove: async () => ({ deleted: true }),
  };
  await withServer(service, async (port) => {
    assert.equal((await request(port, 'GET', '/')).status, 200);
    assert.equal((await request(port, 'GET', '/1')).status, 403);
    assert.equal((await request(port, 'POST', '/', { nombre: 'Aves', slug: 'aves', orden: 1 })).status, 403);
    const created = await request(port, 'POST', '/', { nombre: ' Aves ', slug: 'aves', orden: 1 }, 'catalog:write');
    assert.equal(created.status, 201);
    assert.deepEqual(calls, [['create', { nombre: 'Aves', slug: 'aves', orden: 1 }]]);
    assert.deepEqual((await request(port, 'DELETE', '/1', undefined, 'catalog:write')).body, { deleted: true });
  });
});

test('la validación es estricta y las actualizaciones vacías son rechazadas', () => {
  assert.deepEqual(createCategoriaSchema.parse({ nombre: ' Aves ', slug: 'aves-nativas', orden: 0 }), { nombre: 'Aves', slug: 'aves-nativas', orden: 0 });
  for (const value of [{ nombre: 'Ave', slug: 'Aves', orden: 1 }, { nombre: 'Ave', slug: 'aves', orden: 1, activo: true }, { nombre: 'A', slug: 'aves', orden: 1 }, { nombre: 'Ave', slug: 'aves', orden: 1.5 }]) {
    assert.equal(createCategoriaSchema.safeParse(value).success, false);
  }
  assert.equal(updateCategoriaSchema.safeParse({}).success, false);
  assert.equal(updateCategoriaSchema.safeParse({ descripcion: 'No existe' }).success, false);
});

test('el repositorio usa CRUD parametrizado, lista con orden determinista y no genera SET vacío', async () => {
  const queries = [];
  const repository = createCategoriasRepository({ db: { query: async (sql, params) => {
    queries.push({ sql, params });
    if (sql.startsWith('INSERT')) return [{ insertId: 4 }];
    if (sql.startsWith('DELETE')) return [{ affectedRows: 1 }];
    return [[{ id_categoria: 4, nombre: 'Aves', slug: 'aves', orden: 1 }]];
  } } });
  await repository.findAll();
  await repository.findById(4);
  await repository.create({ nombre: 'Aves', slug: 'aves', orden: 1 });
  await repository.update(4, { nombre: 'Aves nativas' });
  await repository.remove(4);
  await assert.rejects(() => repository.update(4, {}), /al menos un campo/);
  assert.match(queries[0].sql, /ORDER BY orden ASC, id_categoria ASC$/);
  assert.deepEqual(queries[1].params, [4]);
  assert.match(queries[2].sql, /VALUES \(\?, \?, \?\)/);
  assert.deepEqual(queries[4].params, ['Aves nativas', 4]);
  assert.deepEqual(queries[6].params, [4]);
});

test('el servicio responde 404 y traduce conflictos de persistencia sin exponer SQL', async () => {
  const absent = createCategoriasService({ dataRepository: { findAll: async () => [], findById: async () => null, create: async () => {}, update: async () => {}, remove: async () => false } });
  await assert.rejects(() => absent.getById(9), { status: 404, message: 'Categoría no encontrada' });
  await assert.rejects(() => absent.remove(9), { status: 404, message: 'Categoría no encontrada' });
  const deletedDuringUpdate = createCategoriasService({ dataRepository: { findById: async () => ({ id_categoria: 1 }), update: async () => null } });
  await assert.rejects(() => deletedDuringUpdate.update(1, { nombre: 'Aves' }), { status: 404, message: 'Categoría no encontrada' });
  const duplicate = createCategoriasService({ dataRepository: { create: async () => { throw { code: 'ER_DUP_ENTRY', message: 'SQL private' }; } } });
  await assert.rejects(() => duplicate.create({}), { status: 409, message: 'Ya existe una categoría con ese nombre o slug.' });
  const dependent = createCategoriasService({ dataRepository: { remove: async () => { throw { code: 'ER_ROW_IS_REFERENCED_2', message: 'SQL private' }; } } });
  await assert.rejects(() => dependent.remove(1), { status: 409, message: 'No se puede eliminar la categoría porque tiene especies dependientes.' });
});
