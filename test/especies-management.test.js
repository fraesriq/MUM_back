const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const express = require('express');
const { createEspeciesRepository } = require('../src/modules/especies/especies.repository');
const { createEspeciesService } = require('../src/modules/especies/especies.service');
const { createEspeciesController } = require('../src/modules/especies/especies.controller');
const { createEspeciesRouter } = require('../src/modules/especies/especies.routes');
const { createEspecieSchema, updateEspecieSchema, approvalEspecieSchema, managementQuerySchema } = require('../src/modules/especies/especies.validation');

const valid = { id_categoria: 1, slug: 'zorro-culpeo', nombre_comun: 'Zorro culpeo', descripcion: 'Descripción válida' };
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
  app.use(createEspeciesRouter({ dataController: createEspeciesController({ dataService: service }) }));
  app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }));
  const server = http.createServer(app); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await run(server.address().port); } finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

test('gestión precede al slug público, exige escritura y conserva lectura pública', { concurrency: false }, async () => {
  const calls = [];
  const service = {
    getAll: async () => [{ slug: 'zorro-culpeo' }], getBySlug: async (slug) => ({ slug }),
    getManagementAll: async (filters) => { calls.push(['list', filters]); return { items: [], total: 0, ...filters }; },
    getManagementById: async (id) => ({ id_especie: id }), create: async (data) => ({ ...data, estado: 'pendiente' }), update: async (id, data) => ({ id_especie: id, ...data }),
    approve: async (id, estado) => ({ id_especie: id, estado }), remove: async () => ({ deleted: true }),
  };
  await withServer(service, async (port) => {
    assert.equal((await request(port, 'GET', '/gestion')).status, 403);
    assert.equal((await request(port, 'GET', '/gestion', undefined, 'catalog:write')).status, 200);
    assert.deepEqual(calls, [['list', { page: 1, limit: 20 }]]);
    assert.deepEqual((await request(port, 'GET', '/zorro-culpeo')).body, { slug: 'zorro-culpeo' });
    assert.equal((await request(port, 'POST', '/', valid, 'catalog:read')).status, 403);
    const created = await request(port, 'POST', '/', valid, 'catalog:write');
    assert.equal(created.status, 201); assert.equal(created.body.estado, 'pendiente');
    assert.equal((await request(port, 'PATCH', '/7/aprobar', { estado: 'aprobado' })).status, 403);
    assert.deepEqual((await request(port, 'PATCH', '/7/aprobar', { estado: 'aprobado' }, 'catalog:write')).body, { id_especie: 7, estado: 'aprobado' });
    assert.equal((await request(port, 'PATCH', '/7/aprobar', { estado: 'pendiente' }, 'catalog:write')).status, 400);
    assert.equal((await request(port, 'PATCH', '/0/aprobar', { estado: 'aprobado' }, 'catalog:write')).status, 400);
    assert.deepEqual((await request(port, 'DELETE', '/7', undefined, 'catalog:write')).body, { deleted: true });
  });
});

test('validación estricta acepta solo campos administrables y enteros seguros', () => {
  assert.deepEqual(createEspecieSchema.parse({ ...valid, nombre_cientifico: null, id_fuente: null }), { ...valid, nombre_cientifico: null, id_fuente: null });
  for (const value of [{ ...valid, estado: 'aprobado' }, { ...valid, slug: 'Zorro' }, { ...valid, descripcion: ' ' }, { ...valid, id_categoria: 1.1 }, { ...valid, id_categoria: Number.MAX_SAFE_INTEGER + 1 }]) assert.equal(createEspecieSchema.safeParse(value).success, false);
  assert.equal(updateEspecieSchema.safeParse({}).success, false);
  assert.equal(updateEspecieSchema.safeParse({ estado: 'aprobado' }).success, false);
  assert.deepEqual(approvalEspecieSchema.parse({ estado: 'aprobado' }), { estado: 'aprobado' });
  for (const value of [{ estado: 'pendiente' }, { estado: 'aprobado', nombre_comun: 'Zorro' }, {}]) assert.equal(approvalEspecieSchema.safeParse(value).success, false);
  assert.equal(updateEspecieSchema.safeParse({ alimentacion: ' ' }).success, false);
  assert.deepEqual(managementQuerySchema.parse({ estado: 'pendiente', categoria_id: '2' }), { page: 1, limit: 20, estado: 'pendiente', categoria_id: 2 });
  for (const query of [{ page: '0' }, { limit: '101' }, { categoria_id: '1.5' }, { estado: 'otro' }]) assert.equal(managementQuerySchema.safeParse(query).success, false);
});

test('validación acepta máximos declarados y rechaza cada desborde', () => {
  for (const [field, length] of [['slug', 180], ['nombre_comun', 150], ['nombre_cientifico', 200]]) {
    const value = field === 'slug' ? `a-${'a'.repeat(length - 2)}` : 'a'.repeat(length);
    assert.equal(createEspecieSchema.safeParse({ ...valid, [field]: value }).success, true);
    assert.equal(createEspecieSchema.safeParse({ ...valid, [field]: `${value}a` }).success, false);
  }
  for (const field of ['descripcion', 'distribucion_geografica', 'habitat_ecosistema', 'alimentacion', 'habito', 'reproduccion']) {
    const value = 'a'.repeat(10000);
    assert.equal(createEspecieSchema.safeParse({ ...valid, [field]: value }).success, true);
    assert.equal(createEspecieSchema.safeParse({ ...valid, [field]: `${value}a` }).success, false);
  }
});

test('repositorio pagina y filtra con parámetros, orden estable y escrituras permitidas', async () => {
  const queries = [];
  const repository = createEspeciesRepository({ database: { query: async (sql, params) => {
    queries.push({ sql, params }); if (sql.startsWith('SELECT COUNT')) return [[{ total: 1 }]]; if (sql.startsWith('INSERT')) return [{ insertId: 7 }]; if (sql.startsWith('UPDATE') || sql.startsWith('DELETE')) return [{ affectedRows: 1 }]; return [[{ id_especie: 7 }]];
  } } });
  assert.deepEqual(await repository.findManagementAll({ page: 2, limit: 10, estado: 'pendiente', categoria_id: 3 }), { items: [{ id_especie: 7 }], total: 1, page: 2, limit: 10 });
  assert.deepEqual(queries[0].params, ['pendiente', 3]);
  assert.match(queries[1].sql, /ORDER BY id_especie ASC LIMIT \? OFFSET \?$/); assert.deepEqual(queries[1].params, ['pendiente', 3, 10, 10]);
  await repository.create(valid); await repository.update(7, { nombre_comun: 'Zorro andino' });
  assert.equal(await repository.setEstado(7, 'aprobado'), true); assert.equal(await repository.remove(7), true);
  assert.match(queries[2].sql, /estado\) VALUES .*'pendiente'/); assert.doesNotMatch(queries[2].sql, /aprobado/);
  assert.deepEqual(queries[4].params, ['Zorro andino', 7]); await assert.rejects(() => repository.update(7, {}), /al menos un campo/);
  assert.match(queries[6].sql, /^UPDATE especie SET estado = \? WHERE id_especie = \?$/); assert.deepEqual(queries[6].params, ['aprobado', 7]);
  assert.match(queries[7].sql, /^DELETE FROM especie WHERE id_especie = \?$/); assert.deepEqual(queries[7].params, [7]);
});

test('servicio distingue ausencia y traduce conflictos de creación y actualización sin filtrar SQL', async () => {
  const absent = createEspeciesService({ dataRepository: { findManagementById: async () => null } });
  await assert.rejects(() => absent.getManagementById(9), { status: 404, message: 'Especie no encontrada' });
  await assert.rejects(() => absent.update(9, { nombre_comun: 'Zorro' }), { status: 404, message: 'Especie no encontrada' });
  for (const [code, message] of [['ER_DUP_ENTRY', 'Ya existe una especie con ese slug.'], ['ER_NO_REFERENCED_ROW_2', 'La categoría o fuente indicada no existe.']]) {
    const failure = async () => { throw { code, message: 'private SQL' }; };
    const service = createEspeciesService({ dataRepository: { create: failure, findManagementById: async () => ({ id_especie: 1 }), update: failure } });
    await assert.rejects(() => service.create(valid), { status: 409, message });
    await assert.rejects(() => service.update(1, { slug: 'otro-slug' }), { status: 409, message });
  }
  const lifecycleAbsent = createEspeciesService({ dataRepository: { findManagementById: async () => null, remove: async () => false } });
  await assert.rejects(() => lifecycleAbsent.approve(9, 'aprobado'), { status: 404, message: 'Especie no encontrada' });
  await assert.rejects(() => lifecycleAbsent.remove(9), { status: 404, message: 'Especie no encontrada' });
  const lifecycle = createEspeciesService({ dataRepository: { findManagementById: async () => ({ id_especie: 1, estado: 'pendiente' }), setEstado: async () => true } });
  assert.deepEqual(await lifecycle.approve(1, 'rechazado'), { id_especie: 1, estado: 'rechazado' });
  const dependent = createEspeciesService({ dataRepository: { remove: async () => { throw { code: 'ER_ROW_IS_REFERENCED_2', message: 'private SQL' }; } } });
  await assert.rejects(() => dependent.remove(1), { status: 409, message: 'No se puede eliminar la especie porque tiene dependencias.' });
});
