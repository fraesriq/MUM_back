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
    getRegionById: async (req, res, next) => {
      try { res.json(await dataService.getRegionById(req.params.id)); } catch (error) { next(error); }
    },
    createRegion: async (req, res, next) => {
      try { res.status(201).json(await dataService.createRegion(req.body)); } catch (error) { next(error); }
    },
    updateRegion: async (req, res, next) => {
      try { res.json(await dataService.updateRegion(req.params.id, req.body)); } catch (error) { next(error); }
    },
    removeRegion: async (req, res, next) => {
      try { res.json(await dataService.removeRegion(req.params.id)); } catch (error) { next(error); }
    },
    getProvinciaById: async (req, res, next) => {
      try { res.json(await dataService.getProvinciaById(req.params.id)); } catch (error) { next(error); }
    },
    createProvincia: async (req, res, next) => {
      try { res.status(201).json(await dataService.createProvincia(req.body)); } catch (error) { next(error); }
    },
    updateProvincia: async (req, res, next) => {
      try { res.json(await dataService.updateProvincia(req.params.id, req.body)); } catch (error) { next(error); }
    },
    removeProvincia: async (req, res, next) => {
      try { res.json(await dataService.removeProvincia(req.params.id)); } catch (error) { next(error); }
    },
  };
}

module.exports = { createGeografiaController, ...createGeografiaController() };
