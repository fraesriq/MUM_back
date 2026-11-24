const repository = require('./lugares.repository');
const archivosService = require('../archivos/archivos.service');

function createLugaresService({ dataRepository = repository, filesService = archivosService } = {}) {
  return {
    getAll: async () => (await dataRepository.findAll()).map((lugar) => toPublicLugar(lugar)),
    getBySlug: async (slug) => {
      const lugar = await dataRepository.findBySlug(slug);
      return lugar ? { ...toPublicLugar(lugar), archivos: await filesService.mapPublicFiles(lugar.archivos) } : null;
    },
  };
}

function toPublicLugar(lugar) {
  const { id_lugar, id_comuna, id_coordenada, id_fuente, estado, coordenada_confirmada, ...publicLugar } = lugar;
  if (!coordenada_confirmada) return { ...publicLugar, latitud: null, longitud: null, url_mapa: null };
  return publicLugar;
}

module.exports = { createLugaresService, ...createLugaresService() };
