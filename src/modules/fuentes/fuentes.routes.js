const express = require('express');
const controller = require('./fuentes.controller');
const validate = require('../../middlewares/validate.middleware');
const { requireScope } = require('../../auth/application.middleware');
const { createFuenteSchema, updateFuenteSchema, idParamSchema } = require('./fuentes.validation');

function createFuentesRouter({ dataController = controller } = {}) {
  const router = express.Router();
  router.get('/', dataController.getAll);
  router.get('/:id', validate(idParamSchema, 'params'), dataController.getById);
  router.post('/', requireScope('catalog:write'), validate(createFuenteSchema), dataController.create);
  router.put('/:id', requireScope('catalog:write'), validate(idParamSchema, 'params'), validate(updateFuenteSchema), dataController.update);
  router.delete('/:id', requireScope('catalog:write'), validate(idParamSchema, 'params'), dataController.remove);
  return router;
}

module.exports = createFuentesRouter();
module.exports.createFuentesRouter = createFuentesRouter;
