const repository = require('./especies.repository');
const archivosService = require('../archivos/archivos.service');

function createEspeciesService({ dataRepository = repository, filesService = archivosService } = {}) {
  return {
    getAll: (filtros) => dataRepository.findAll(filtros),
    getBySlug: async (slug) => {
      const especie = await dataRepository.findBySlug(slug);
      if (!especie) return null;
      const { id_especie, id_categoria, id_fuente, estado, ...publicEspecie } = especie;
      return { ...publicEspecie, archivos: await filesService.mapPublicFiles(especie.archivos) };
    },
  };
}

module.exports = { createEspeciesService, ...createEspeciesService() };
