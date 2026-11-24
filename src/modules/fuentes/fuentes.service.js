const repository = require('./fuentes.repository');

function createFuentesService({ dataRepository = repository } = {}) {
  return {
    getAll: async () => (await dataRepository.findAll()).map(toPublicFuente),
    getById: async (id) => {
      const fuente = await dataRepository.findById(id);
      return fuente ? toPublicFuente(fuente) : null;
    },
  };
}

function toPublicFuente({ id_fuente, titulo, tipo, autor_institucion, url, verificada }) {
  return { id_fuente, titulo, tipo, autor_institucion, url, verificada: Boolean(verificada) };
}

module.exports = { createFuentesService, toPublicFuente, ...createFuentesService() };
