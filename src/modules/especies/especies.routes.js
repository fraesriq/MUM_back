const express = require('express');
const router = express.Router();
const controller = require('./especies.controller');
const validate = require('../../middlewares/validate.middleware');
const { requireScope } = require('../../auth/application.middleware');
const { createEspecieSchema, updateEspecieSchema, approvalEspecieSchema, idParamSchema, associationParamSchema, archivoAssociationSchema, managementQuerySchema } = require('./especies.validation');

function createEspeciesRouter({ dataController = controller } = {}) {
  const router = express.Router();
  router.get('/gestion', requireScope('catalog:write'), validate(managementQuerySchema, 'query'), dataController.getManagementAll);
  router.get('/gestion/:id', requireScope('catalog:write'), validate(idParamSchema, 'params'), dataController.getManagementById);
  router.post('/', requireScope('catalog:write'), validate(createEspecieSchema), dataController.create);
  router.put('/:id/archivos/:archivoId', requireScope('catalog:write'), validate(associationParamSchema, 'params'), validate(archivoAssociationSchema), dataController.associateArchivo);
  router.delete('/:id/archivos/:archivoId', requireScope('catalog:write'), validate(associationParamSchema, 'params'), dataController.removeArchivoAssociation);
  router.put('/:id', requireScope('catalog:write'), validate(idParamSchema, 'params'), validate(updateEspecieSchema), dataController.update);
  router.patch('/:id/aprobar', requireScope('catalog:write'), validate(idParamSchema, 'params'), validate(approvalEspecieSchema), dataController.approve);
  router.delete('/:id', requireScope('catalog:write'), validate(idParamSchema, 'params'), dataController.remove);
  router.get('/', dataController.getAll);
  router.get('/:slug', dataController.getBySlug);
  return router;
}

module.exports = createEspeciesRouter();
module.exports.createEspeciesRouter = createEspeciesRouter;
