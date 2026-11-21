const repo = require('./galeria.repository');
const { createGaleriaSchema } = require('./galeria.validation');

exports.getAll = (filters) => repo.findAll(filters);

exports.getById = async (id) => {
  const item = await repo.findById(id);
  if (!item) throw Object.assign(new Error('Archivo no encontrado'), { status: 404 });
  return item;
};

exports.create = (data) => repo.create(data);

exports.update = async (id, data) => {
  const item = await repo.findByIdForManagement(id);
  if (!item) throw Object.assign(new Error('Archivo no encontrado'), { status: 404 });
  const validation = createGaleriaSchema.safeParse({
    id_fuente: item.id_fuente,
    tipo: item.tipo,
    titulo: item.titulo,
    ruta: item.ruta,
    texto_alt: item.texto_alt,
    credito: item.credito,
    permiso: item.permiso,
    en_galeria_general: Boolean(item.en_galeria_general),
    orden_galeria: item.orden_galeria,
    ...data,
  });
  if (!validation.success) {
    throw Object.assign(new Error(validation.error.issues[0].message), { status: 400 });
  }
  return repo.update(id, data);
};

exports.remove = async (id) => {
  const deleted = await repo.remove(id);
  if (!deleted) throw Object.assign(new Error('Archivo no encontrado'), { status: 404 });
  return { deleted: true };
};
