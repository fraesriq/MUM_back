const service = require('./categorias.service');

function createCategoriasController({ dataService = service } = {}) {
  return {
    getAll: async (req, res, next) => {
      try { res.json(await dataService.getAll()); } catch (error) { next(error); }
    },
    getById: async (req, res, next) => {
      try { res.json(await dataService.getById(req.params.id)); } catch (error) { next(error); }
    },
    create: async (req, res, next) => {
      try { res.status(201).json(await dataService.create(req.body)); } catch (error) { next(error); }
    },
    update: async (req, res, next) => {
      try { res.json(await dataService.update(req.params.id, req.body)); } catch (error) { next(error); }
    },
    remove: async (req, res, next) => {
      try { res.json(await dataService.remove(req.params.id)); } catch (error) { next(error); }
    },
  };
}

module.exports = { createCategoriasController, ...createCategoriasController() };
