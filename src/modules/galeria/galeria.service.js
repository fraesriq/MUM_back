const repo = require('./galeria.repository');

exports.getAll = (filters) => repo.findAll(filters);

exports.getById = async (id) => {
  const item = await repo.findById(id);
  if (!item) throw Object.assign(new Error('Archivo no encontrado'), { status: 404 });
  return item;
};

exports.create = (data) => repo.create(data);

exports.update = async (id, data) => {
  await exports.getById(id);
  return repo.update(id, data);
};

exports.remove = async (id) => {
  const deleted = await repo.remove(id);
  if (!deleted) throw Object.assign(new Error('Archivo no encontrado'), { status: 404 });
  return { deleted: true };
};