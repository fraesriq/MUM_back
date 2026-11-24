const repository = require('./coordenadas.repository');

function operationalError(message, status) { return Object.assign(new Error(message), { status }); }
function toCoordenadaDto({ id_coordenada, latitud, longitud, url_mapa, confirmada }) {
  return { id_coordenada, latitud: Number(latitud), longitud: Number(longitud), url_mapa, confirmada: Boolean(confirmada) };
}
function translateDeleteError(error) {
  return ['ER_ROW_IS_REFERENCED', 'ER_ROW_IS_REFERENCED_2'].includes(error.code)
    ? operationalError('No se puede eliminar la coordenada porque tiene dependencias.', 409) : error;
}

function createCoordenadasService({ dataRepository = repository } = {}) {
  const getById = async (id) => {
    const coordinate = await dataRepository.findById(id);
    if (!coordinate) throw operationalError('Coordenada no encontrada', 404);
    return toCoordenadaDto(coordinate);
  };
  return {
    getAll: async (pagination) => {
      const result = await dataRepository.findAll(pagination);
      return { ...result, items: result.items.map(toCoordenadaDto) };
    },
    getById,
    create: async (data) => toCoordenadaDto(await dataRepository.create(data)),
    update: async (id, data) => { await getById(id); const coordinate = await dataRepository.update(id, data); if (!coordinate) throw operationalError('Coordenada no encontrada', 404); return toCoordenadaDto(coordinate); },
    remove: async (id) => {
      try { if (!await dataRepository.remove(id)) throw operationalError('Coordenada no encontrada', 404); return { deleted: true }; }
      catch (error) { throw translateDeleteError(error); }
    },
  };
}

module.exports = { createCoordenadasService, toCoordenadaDto, operationalError, ...createCoordenadasService() };
