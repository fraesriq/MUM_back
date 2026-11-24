const repository = require('./lugares.repository');
const archivosService = require('../archivos/archivos.service');

function operationalError(message, status) { return Object.assign(new Error(message), { status }); }
function translatePersistenceError(error) {
  if (error.code === 'ER_DUP_ENTRY') return operationalError('El slug o coordenada ya está en uso.', 409);
  if (['ER_NO_REFERENCED_ROW', 'ER_NO_REFERENCED_ROW_2'].includes(error.code)) return operationalError('La comuna, coordenada o fuente indicada no existe.', 409);
  return error;
}
function translateDeleteError(error) {
  if (['ER_ROW_IS_REFERENCED', 'ER_ROW_IS_REFERENCED_2'].includes(error.code)) {
    return operationalError('No se puede eliminar el lugar porque tiene dependencias.', 409);
  }
  return error;
}

function createLugaresService({ dataRepository = repository, filesService = archivosService } = {}) {
  return {
    getAll: async () => (await dataRepository.findAll()).map((lugar) => toPublicLugar(lugar)),
    getBySlug: async (slug) => {
      const lugar = await dataRepository.findBySlug(slug);
      return lugar ? { ...toPublicLugar(lugar), archivos: await filesService.mapPublicFiles(lugar.archivos) } : null;
    },
    getManagementAll: (filters) => dataRepository.findManagementAll(filters),
    getManagementById: async (id) => {
      const lugar = await dataRepository.findManagementById(id);
      if (!lugar) throw operationalError('Lugar no encontrado', 404);
      return lugar;
    },
    create: async (data) => {
      try { return await dataRepository.create(data); } catch (error) { throw translatePersistenceError(error); }
    },
    update: async (id, data) => {
      if (!await dataRepository.findManagementById(id)) throw operationalError('Lugar no encontrado', 404);
      try { return await dataRepository.update(id, data); } catch (error) { throw translatePersistenceError(error); }
    },
    approve: async (id, estado) => {
      const lugar = await dataRepository.findManagementById(id);
      if (!lugar || !await dataRepository.setEstado(id, estado)) throw operationalError('Lugar no encontrado', 404);
      return { ...lugar, estado };
    },
    remove: async (id) => {
      try {
        if (!await dataRepository.remove(id)) throw operationalError('Lugar no encontrado', 404);
        return { deleted: true };
      } catch (error) { throw translateDeleteError(error); }
    },
  };
}

function toPublicLugar(lugar) {
  const { id_lugar, id_comuna, id_coordenada, id_fuente, estado, coordenada_confirmada, ...publicLugar } = lugar;
  if (!coordenada_confirmada) return { ...publicLugar, latitud: null, longitud: null, url_mapa: null };
  return publicLugar;
}

module.exports = { createLugaresService, operationalError, ...createLugaresService() };
