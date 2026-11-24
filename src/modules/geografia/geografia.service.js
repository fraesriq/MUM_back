const repository = require('./geografia.repository');

function operationalError(message, status) {
  return Object.assign(new Error(message), { status });
}

function translatePersistenceError(error, action, resource) {
  if (error.code === 'ER_DUP_ENTRY') return operationalError(`Ya existe ${resource === 'region' ? 'una región' : 'una provincia'} con ese nombre.`, 409);
  if (resource === 'provincia' && ['ER_NO_REFERENCED_ROW', 'ER_NO_REFERENCED_ROW_2'].includes(error.code)) return operationalError('La región indicada no existe.', 409);
  if (action === 'delete' && ['ER_ROW_IS_REFERENCED', 'ER_ROW_IS_REFERENCED_2'].includes(error.code)) {
    return operationalError(`No se puede eliminar ${resource === 'region' ? 'la región porque tiene provincias' : 'la provincia porque tiene comunas'} dependientes.`, 409);
  }
  return error;
}

function createGeografiaService({ dataRepository = repository } = {}) {
  const getRegionById = async (id) => {
    const region = await dataRepository.findRegionById(id);
    if (!region) throw operationalError('Región no encontrada', 404);
    return region;
  };
  const getProvinciaById = async (id) => {
    const provincia = await dataRepository.findProvinciaById(id);
    if (!provincia) throw operationalError('Provincia no encontrada', 404);
    return provincia;
  };
  const ensureRegionExists = async (id) => {
    if (!await dataRepository.findRegionById(id)) throw operationalError('La región indicada no existe.', 409);
  };
  return {
    getRegiones: async () => dataRepository.findRegiones(),
    getProvinciasByRegionId: async (regionId) => {
      if (!await dataRepository.findRegionById(regionId)) return null;
      return dataRepository.findProvinciasByRegionId(regionId);
    },
    getComunasByProvinciaId: async (provinciaId) => {
      if (!await dataRepository.findProvinciaById(provinciaId)) return null;
      return dataRepository.findComunasByProvinciaId(provinciaId);
    },
    getRegionById,
    createRegion: async (data) => {
      try { return await dataRepository.createRegion(data); } catch (error) { throw translatePersistenceError(error, 'create', 'region'); }
    },
    updateRegion: async (id, data) => {
      await getRegionById(id);
      try { return await dataRepository.updateRegion(id, data); } catch (error) { throw translatePersistenceError(error, 'update', 'region'); }
    },
    removeRegion: async (id) => {
      try {
        if (!await dataRepository.removeRegion(id)) throw operationalError('Región no encontrada', 404);
        return { deleted: true };
      } catch (error) { throw translatePersistenceError(error, 'delete', 'region'); }
    },
    getProvinciaById,
    createProvincia: async (data) => {
      await ensureRegionExists(data.id_region);
      try { return await dataRepository.createProvincia(data); } catch (error) { throw translatePersistenceError(error, 'create', 'provincia'); }
    },
    updateProvincia: async (id, data) => {
      await getProvinciaById(id);
      if (data.id_region !== undefined) await ensureRegionExists(data.id_region);
      try { return await dataRepository.updateProvincia(id, data); } catch (error) { throw translatePersistenceError(error, 'update', 'provincia'); }
    },
    removeProvincia: async (id) => {
      try {
        if (!await dataRepository.removeProvincia(id)) throw operationalError('Provincia no encontrada', 404);
        return { deleted: true };
      } catch (error) { throw translatePersistenceError(error, 'delete', 'provincia'); }
    },
  };
}

module.exports = { createGeografiaService, operationalError, ...createGeografiaService() };
