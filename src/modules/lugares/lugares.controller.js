const service = require('./lugares.service');

function createLugaresController({ dataService = service } = {}) {
  return {
    getAll: async (req, res, next) => {
      try { res.json(await dataService.getAll()); } catch (error) { next(error); }
    },
    getBySlug: async (req, res, next) => {
      try {
        const lugar = await dataService.getBySlug(req.params.slug);
        if (!lugar) return res.status(404).json({ message: 'Lugar no encontrado' });
        res.json(lugar);
      } catch (error) { next(error); }
    },
    getManagementAll: async (req, res, next) => {
      try { res.json(await dataService.getManagementAll(res.locals.validated.query)); } catch (error) { next(error); }
    },
    getManagementById: async (req, res, next) => {
      try { res.json(await dataService.getManagementById(req.params.id)); } catch (error) { next(error); }
    },
    create: async (req, res, next) => {
      try { res.status(201).json(await dataService.create(req.body)); } catch (error) { next(error); }
    },
    update: async (req, res, next) => {
      try { res.json(await dataService.update(req.params.id, req.body)); } catch (error) { next(error); }
    },
  };
}

module.exports = { createLugaresController, ...createLugaresController() };
