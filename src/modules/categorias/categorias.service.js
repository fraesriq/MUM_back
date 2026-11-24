const repository = require('./categorias.repository');

function operationalError(message, status) {
  return Object.assign(new Error(message), { status });
}

function translatePersistenceError(error, action) {
  if (error.code === 'ER_DUP_ENTRY') return operationalError('Ya existe una categoría con ese nombre o slug.', 409);
  if (action === 'delete' && ['ER_ROW_IS_REFERENCED', 'ER_ROW_IS_REFERENCED_2'].includes(error.code)) {
    return operationalError('No se puede eliminar la categoría porque tiene especies dependientes.', 409);
  }
  return error;
}

function createCategoriasService({ dataRepository = repository } = {}) {
  const getById = async (id) => {
    const categoria = await dataRepository.findById(id);
    if (!categoria) throw operationalError('Categoría no encontrada', 404);
    return categoria;
  };
  return {
    getAll: () => dataRepository.findAll(),
    getById,
    create: async (data) => {
      try { return await dataRepository.create(data); } catch (error) { throw translatePersistenceError(error, 'create'); }
    },
    update: async (id, data) => {
      await getById(id);
      try { return await dataRepository.update(id, data); } catch (error) { throw translatePersistenceError(error, 'update'); }
    },
    remove: async (id) => {
      try {
        if (!await dataRepository.remove(id)) throw operationalError('Categoría no encontrada', 404);
        return { deleted: true };
      } catch (error) { throw translatePersistenceError(error, 'delete'); }
    },
  };
}

module.exports = { createCategoriasService, operationalError, ...createCategoriasService() };
