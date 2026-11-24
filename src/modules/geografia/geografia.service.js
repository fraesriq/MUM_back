const repository = require('./geografia.repository');

function createGeografiaService({ dataRepository = repository } = {}) {
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
  };
}

module.exports = { createGeografiaService, ...createGeografiaService() };
