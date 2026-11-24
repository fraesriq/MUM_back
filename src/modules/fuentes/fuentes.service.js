const repository = require('./fuentes.repository');

function operationalError(message, status) {
  return Object.assign(new Error(message), { status });
}

function translatePersistenceError(error, action) {
  if (action === 'delete' && ['ER_ROW_IS_REFERENCED', 'ER_ROW_IS_REFERENCED_2'].includes(error.code)) {
    return operationalError('No se puede eliminar la fuente porque tiene dependencias.', 409);
  }
  return error;
}

function createFuentesService({ dataRepository = repository } = {}) {
  const getById = async (id) => {
    const fuente = await dataRepository.findById(id);
    if (!fuente) throw operationalError('Fuente no encontrada', 404);
    return toPublicFuente(fuente);
  };
  return {
    getAll: async () => (await dataRepository.findAll()).map(toPublicFuente),
    getById,
    create: async (data) => {
      try { return toPublicFuente(await dataRepository.create(data)); } catch (error) { throw translatePersistenceError(error, 'create'); }
    },
    update: async (id, data) => {
      await getById(id);
      try { return toPublicFuente(await dataRepository.update(id, data)); } catch (error) { throw translatePersistenceError(error, 'update'); }
    },
    remove: async (id) => {
      try {
        if (!await dataRepository.remove(id)) throw operationalError('Fuente no encontrada', 404);
        return { deleted: true };
      } catch (error) { throw translatePersistenceError(error, 'delete'); }
    },
  };
}

function toPublicFuente({ id_fuente, titulo, tipo, autor_institucion, url, verificada }) {
  return { id_fuente, titulo, tipo, autor_institucion, url, verificada: Boolean(verificada) };
}

module.exports = { createFuentesService, toPublicFuente, operationalError, ...createFuentesService() };
