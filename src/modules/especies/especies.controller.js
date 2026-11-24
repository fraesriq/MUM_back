const service = require('./especies.service');

function createEspeciesController({ dataService = service } = {}) {
  return {
    getAll: async (req, res, next) => {
      try {
        const especies = await dataService.getAll({ categoria: req.query.categoria });
        res.json(especies);
      } catch (error) { next(error); }
    },
    getBySlug: async (req, res, next) => {
      try {
        const especie = await dataService.getBySlug(req.params.slug);
        if (!especie) return res.status(404).json({ message: 'Especie no encontrada' });
        res.json(especie);
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
    approve: async (req, res, next) => {
      try { res.json(await dataService.approve(req.params.id, req.body.estado)); } catch (error) { next(error); }
    },
    remove: async (req, res, next) => {
      try { res.json(await dataService.remove(req.params.id)); } catch (error) { next(error); }
    },
    associateArchivo: async (req, res, next) => {
      try { res.json(await dataService.associateArchivo(req.params.id, req.params.archivoId, req.body)); } catch (error) { next(error); }
    },
    removeArchivoAssociation: async (req, res, next) => {
      try { res.json(await dataService.removeArchivoAssociation(req.params.id, req.params.archivoId)); } catch (error) { next(error); }
    },
  };
}

module.exports = { createEspeciesController, ...createEspeciesController() };
