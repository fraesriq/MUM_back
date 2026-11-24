const express = require('express');
const controller = require('./fuentes.controller');
const validate = require('../../middlewares/validate.middleware');
const { idParamSchema } = require('./fuentes.validation');

function createFuentesRouter({ dataController = controller } = {}) {
  const router = express.Router();
  router.get('/', dataController.getAll);
  router.get('/:id', validate(idParamSchema, 'params'), dataController.getById);
  return router;
}

module.exports = createFuentesRouter();
module.exports.createFuentesRouter = createFuentesRouter;
