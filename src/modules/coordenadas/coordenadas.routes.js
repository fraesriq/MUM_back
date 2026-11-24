const express = require('express');
const controller = require('./coordenadas.controller');
const validate = require('../../middlewares/validate.middleware');
const { requireScope } = require('../../auth/application.middleware');
const { createCoordenadaSchema, updateCoordenadaSchema, idParamSchema, paginationQuerySchema } = require('./coordenadas.validation');

function createCoordenadasRouter({ dataController = controller } = {}) {
  const router = express.Router();
  router.use(requireScope('catalog:write'));
  router.get('/', validate(paginationQuerySchema, 'query'), dataController.getAll);
  router.get('/:id', validate(idParamSchema, 'params'), dataController.getById);
  router.post('/', validate(createCoordenadaSchema), dataController.create);
  router.put('/:id', validate(idParamSchema, 'params'), validate(updateCoordenadaSchema), dataController.update);
  router.delete('/:id', validate(idParamSchema, 'params'), dataController.remove);
  return router;
}

module.exports = createCoordenadasRouter();
module.exports.createCoordenadasRouter = createCoordenadasRouter;
