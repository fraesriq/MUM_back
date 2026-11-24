const service = require('./coordenadas.service');

function createCoordenadasController({ dataService = service } = {}) {
  const respond = (method, status = 200) => async (req, res, next) => {
    try { res.status(status).json(await method(req, res)); } catch (error) { next(error); }
  };
  return {
    getAll: respond((req, res) => dataService.getAll(res.locals.validated.query)),
    getById: respond((req) => dataService.getById(req.params.id)),
    create: respond((req) => dataService.create(req.body), 201),
    update: respond((req) => dataService.update(req.params.id, req.body)),
    remove: respond((req) => dataService.remove(req.params.id)),
  };
}

module.exports = { createCoordenadasController, ...createCoordenadasController() };
