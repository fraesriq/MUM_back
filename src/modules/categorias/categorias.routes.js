const express = require('express');
const controller = require('./categorias.controller');
const validate = require('../../middlewares/validate.middleware');
const { requireScope } = require('../../auth/application.middleware');
const { createCategoriaSchema, updateCategoriaSchema, idParamSchema } = require('./categorias.validation');

function createCategoriasRouter({ dataController = controller } = {}) {
  const router = express.Router();
  router.get('/', dataController.getAll);
  router.get('/:id', requireScope('catalog:write'), validate(idParamSchema, 'params'), dataController.getById);
  router.post('/', requireScope('catalog:write'), validate(createCategoriaSchema), dataController.create);
  router.put('/:id', requireScope('catalog:write'), validate(idParamSchema, 'params'), validate(updateCategoriaSchema), dataController.update);
  router.delete('/:id', requireScope('catalog:write'), validate(idParamSchema, 'params'), dataController.remove);
  return router;
}

module.exports = createCategoriasRouter();
module.exports.createCategoriasRouter = createCategoriasRouter;
