const repo = require('./contenidos.repository');

exports.getAll = (filters) => repo.findAll(filters);
exports.getAprobados = (filters) => repo.findAllAprobados(filters);

exports.getById = async (id) => {
  const item = await repo.findById(id);
  if (!item) throw Object.assign(new Error('Contenido no encontrado'), { status: 404 });
  return item;
};

exports.create = (data) => repo.create(data);

exports.update = async (id, data) => {
  await exports.getById(id);
  return repo.update(id, data);
};

exports.aprobar = async (id, { estado }) => {
  await exports.getById(id);
  return repo.update(id, { estado });
};

exports.remove = async (id) => {
  const deleted = await repo.remove(id);
  if (!deleted) throw Object.assign(new Error('Contenido no encontrado'), { status: 404 });
  return { deleted: true };
};
