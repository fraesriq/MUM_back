const service = require('./geografia.service');

function createGeografiaController({ dataService = service } = {}) {
  return {
    getRegiones: async (req, res, next) => {
      try {
        res.json(await dataService.getRegiones());
      } catch (error) { next(error); }
    },
    getProvinciasByRegionId: async (req, res, next) => {
      try {
        const provincias = await dataService.getProvinciasByRegionId(req.params.id);
        if (!provincias) return res.status(404).json({ message: 'Región no encontrada' });
        res.json(provincias);
      } catch (error) { next(error); }
    },
    getComunasByProvinciaId: async (req, res, next) => {
      try {
        const comunas = await dataService.getComunasByProvinciaId(req.params.id);
        if (!comunas) return res.status(404).json({ message: 'Provincia no encontrada' });
        res.json(comunas);
      } catch (error) { next(error); }
    },
  };
}

module.exports = { createGeografiaController, ...createGeografiaController() };
