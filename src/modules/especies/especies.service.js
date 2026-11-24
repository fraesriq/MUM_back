const repository = require('./especies.repository');
const archivosService = require('../archivos/archivos.service');
const archivosRepository = require('../archivos/archivos.repository');

function operationalError(message, status) { return Object.assign(new Error(message), { status }); }
function translatePersistenceError(error) {
  if (error.code === 'ER_DUP_ENTRY') return operationalError('Ya existe una especie con ese slug.', 409);
  if (['ER_NO_REFERENCED_ROW', 'ER_NO_REFERENCED_ROW_2'].includes(error.code)) return operationalError('La categoría o fuente indicada no existe.', 409);
  return error;
}

function translateDeleteError(error) {
  if (['ER_ROW_IS_REFERENCED', 'ER_ROW_IS_REFERENCED_2'].includes(error.code)) {
    return operationalError('No se puede eliminar la especie porque tiene dependencias.', 409);
  }
  return error;
}

function translateAssociationError(error) {
  if (['ER_NO_REFERENCED_ROW', 'ER_NO_REFERENCED_ROW_2'].includes(error.code)) return operationalError('La especie o el archivo no existe.', 404);
  return operationalError('Error interno del servidor', 500);
}

function createEspeciesService({ dataRepository = repository, filesService = archivosService, filesRepository = archivosRepository } = {}) {
  return {
    getAll: (filtros) => dataRepository.findAll(filtros),
    getBySlug: async (slug) => {
      const especie = await dataRepository.findBySlug(slug);
      if (!especie) return null;
      const { id_especie, id_categoria, id_fuente, estado, ...publicEspecie } = especie;
      return { ...publicEspecie, archivos: await filesService.mapPublicFiles(especie.archivos) };
    },
    getManagementAll: (filters) => dataRepository.findManagementAll(filters),
    getManagementById: async (id) => {
      const especie = await dataRepository.findManagementById(id);
      if (!especie) throw operationalError('Especie no encontrada', 404);
      return especie;
    },
    create: async (data) => {
      try { return await dataRepository.create(data); } catch (error) { throw translatePersistenceError(error); }
    },
    update: async (id, data) => {
      const especie = await dataRepository.findManagementById(id);
      if (!especie) throw operationalError('Especie no encontrada', 404);
      try {
        const updated = await dataRepository.update(id, data);
        if (!updated) throw operationalError('Especie no encontrada', 404);
        return updated;
      } catch (error) { throw translatePersistenceError(error); }
    },
    approve: async (id, estado) => {
      const especie = await dataRepository.findManagementById(id);
      if (!especie || !await dataRepository.setEstado(id, estado)) throw operationalError('Especie no encontrada', 404);
      return { ...especie, estado };
    },
    remove: async (id) => {
      try {
        if (!await dataRepository.remove(id)) throw operationalError('Especie no encontrada', 404);
        return { deleted: true };
      } catch (error) { throw translateDeleteError(error); }
    },
    associateArchivo: async (id, archivoId, data) => {
      try {
        if (!await dataRepository.findManagementById(id)) throw operationalError('Especie no encontrada', 404);
        if (!await filesRepository.findById(archivoId)) throw operationalError('Archivo no encontrado', 404);
        return await dataRepository.upsertArchivoAssociation(id, archivoId, data);
      } catch (error) { if (error.status) throw error; throw translateAssociationError(error); }
    },
    removeArchivoAssociation: async (id, archivoId) => {
      try {
        if (!await dataRepository.findManagementById(id)) throw operationalError('Especie no encontrada', 404);
        if (!await filesRepository.findById(archivoId)) throw operationalError('Archivo no encontrado', 404);
        if (!await dataRepository.removeArchivoAssociation(id, archivoId)) throw operationalError('La asociación de especie y archivo no existe.', 404);
        return { deleted: true };
      } catch (error) { if (error.status) throw error; throw translateAssociationError(error); }
    },
  };
}

module.exports = { createEspeciesService, operationalError, ...createEspeciesService() };
