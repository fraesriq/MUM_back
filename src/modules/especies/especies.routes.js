const express = require('express');
const router = express.Router();
const controller = require('./especies.controller');
const validate = require('../../middlewares/validate.middleware');
const { requireScope } = require('../../auth/application.middleware');
const { createEspecieSchema, updateEspecieSchema, idParamSchema, managementQuerySchema } = require('./especies.validation');

function createEspeciesRouter({ dataController = controller } = {}) {
  const router = express.Router();
  router.get('/gestion', requireScope('catalog:write'), validate(managementQuerySchema, 'query'), dataController.getManagementAll);
  router.get('/gestion/:id', requireScope('catalog:write'), validate(idParamSchema, 'params'), dataController.getManagementById);
  router.post('/', requireScope('catalog:write'), validate(createEspecieSchema), dataController.create);
  router.put('/:id', requireScope('catalog:write'), validate(idParamSchema, 'params'), validate(updateEspecieSchema), dataController.update);
  router.get('/', dataController.getAll);
  router.get('/:slug', dataController.getBySlug);
  return router;
}

module.exports = createEspeciesRouter();
module.exports.createEspeciesRouter = createEspeciesRouter;
