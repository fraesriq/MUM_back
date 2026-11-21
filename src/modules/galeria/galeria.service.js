const archivosService = require('../archivos/archivos.service');

function createGaleriaService({ service = archivosService } = {}) {
  return { getAll: (filters) => service.getPublicGallery(filters), getById: (id) => service.getPublicGalleryById(id) };
}

module.exports = { createGaleriaService, ...createGaleriaService() };
