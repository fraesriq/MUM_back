const express = require('express');
const controller = require('./lugares.controller');
const validate = require('../../middlewares/validate.middleware');
const { requireScope } = require('../../auth/application.middleware');
const { createLugarSchema, updateLugarSchema, approvalLugarSchema, idParamSchema, managementQuerySchema } = require('./lugares.validation');

function createLugaresRouter({ dataController = controller } = {}) {
  const router = express.Router();
  router.get('/gestion', requireScope('catalog:write'), validate(managementQuerySchema, 'query'), dataController.getManagementAll);
  router.get('/gestion/:id', requireScope('catalog:write'), validate(idParamSchema, 'params'), dataController.getManagementById);
  router.post('/', requireScope('catalog:write'), validate(createLugarSchema), dataController.create);
  router.put('/:id', requireScope('catalog:write'), validate(idParamSchema, 'params'), validate(updateLugarSchema), dataController.update);
  router.patch('/:id/aprobar', requireScope('catalog:write'), validate(idParamSchema, 'params'), validate(approvalLugarSchema), dataController.approve);
  router.delete('/:id', requireScope('catalog:write'), validate(idParamSchema, 'params'), dataController.remove);
  router.get('/', dataController.getAll);
  router.get('/:slug', dataController.getBySlug);
  return router;
}

module.exports = createLugaresRouter();
module.exports.createLugaresRouter = createLugaresRouter;
