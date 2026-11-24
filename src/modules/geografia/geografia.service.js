const repository = require('./geografia.repository');

function operationalError(message, status) {
  return Object.assign(new Error(message), { status });
}

function translatePersistenceError(error, action, resource) {
  if (error.code === 'ER_DUP_ENTRY') return operationalError(`Ya existe ${resource === 'region' ? 'una región' : resource === 'provincia' ? 'una provincia' : 'una comuna'} con ese nombre.`, 409);
  if (resource === 'provincia' && ['ER_NO_REFERENCED_ROW', 'ER_NO_REFERENCED_ROW_2'].includes(error.code)) return operationalError('La región indicada no existe.', 409);
  if (resource === 'comuna' && ['ER_NO_REFERENCED_ROW', 'ER_NO_REFERENCED_ROW_2'].includes(error.code)) return operationalError('La provincia indicada no existe.', 409);
  if (action === 'delete' && ['ER_ROW_IS_REFERENCED', 'ER_ROW_IS_REFERENCED_2'].includes(error.code)) {
    return operationalError(`No se puede eliminar ${resource === 'region' ? 'la región porque tiene provincias' : resource === 'provincia' ? 'la provincia porque tiene comunas' : 'la comuna porque tiene lugares'} dependientes.`, 409);
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
  const getComunaById = async (id) => {
    const comuna = await dataRepository.findComunaById(id);
    if (!comuna) throw operationalError('Comuna no encontrada', 404);
    return comuna;
  };
  const ensureRegionExists = async (id) => {
    if (!await dataRepository.findRegionById(id)) throw operationalError('La región indicada no existe.', 409);
  };
  const ensureProvinciaExists = async (id) => {
    if (!await dataRepository.findProvinciaById(id)) throw operationalError('La provincia indicada no existe.', 409);
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
      try {
        const region = await dataRepository.updateRegion(id, data);
        if (!region) throw operationalError('Región no encontrada', 404);
        return region;
      } catch (error) { throw translatePersistenceError(error, 'update', 'region'); }
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
      try {
        const provincia = await dataRepository.updateProvincia(id, data);
        if (!provincia) throw operationalError('Provincia no encontrada', 404);
        return provincia;
      } catch (error) { throw translatePersistenceError(error, 'update', 'provincia'); }
    },
    removeProvincia: async (id) => {
      try {
        if (!await dataRepository.removeProvincia(id)) throw operationalError('Provincia no encontrada', 404);
        return { deleted: true };
      } catch (error) { throw translatePersistenceError(error, 'delete', 'provincia'); }
    },
    getComunaById,
    createComuna: async (data) => {
      await ensureProvinciaExists(data.id_provincia);
      try { return await dataRepository.createComuna(data); } catch (error) { throw translatePersistenceError(error, 'create', 'comuna'); }
    },
    updateComuna: async (id, data) => {
      await getComunaById(id);
      if (data.id_provincia !== undefined) await ensureProvinciaExists(data.id_provincia);
      try {
        const comuna = await dataRepository.updateComuna(id, data);
        if (!comuna) throw operationalError('Comuna no encontrada', 404);
        return comuna;
      } catch (error) { throw translatePersistenceError(error, 'update', 'comuna'); }
    },
    removeComuna: async (id) => {
      try {
        if (!await dataRepository.removeComuna(id)) throw operationalError('Comuna no encontrada', 404);
        return { deleted: true };
      } catch (error) { throw translatePersistenceError(error, 'delete', 'comuna'); }
    },
  };
}

module.exports = { createGeografiaService, operationalError, ...createGeografiaService() };
