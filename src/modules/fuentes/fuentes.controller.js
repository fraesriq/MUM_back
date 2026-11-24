const service = require('./fuentes.service');

function createFuentesController({ dataService = service } = {}) {
  return {
    getAll: async (req, res, next) => {
      try {
        res.json(await dataService.getAll());
      } catch (error) { next(error); }
    },
    getById: async (req, res, next) => {
      try {
        const fuente = await dataService.getById(req.params.id);
        if (!fuente) return res.status(404).json({ message: 'Fuente no encontrada' });
        res.json(fuente);
      } catch (error) { next(error); }
    },
  };
}

module.exports = { createFuentesController, ...createFuentesController() };
