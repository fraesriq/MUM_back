const express = require('express');
const controller = require('./geografia.controller');
const validate = require('../../middlewares/validate.middleware');
const { requireScope } = require('../../auth/application.middleware');
const { idParamSchema, regionSchema, provinciaSchema, updateRegionSchema, updateProvinciaSchema } = require('./geografia.validation');

function createGeografiaRouter({ dataController = controller } = {}) {
  const router = express.Router();
  router.get('/regiones', dataController.getRegiones);
  router.get('/regiones/:id/provincias', validate(idParamSchema, 'params'), dataController.getProvinciasByRegionId);
  router.get('/regiones/:id', requireScope('catalog:write'), validate(idParamSchema, 'params'), dataController.getRegionById);
  router.post('/regiones', requireScope('catalog:write'), validate(regionSchema), dataController.createRegion);
  router.put('/regiones/:id', requireScope('catalog:write'), validate(idParamSchema, 'params'), validate(updateRegionSchema), dataController.updateRegion);
  router.delete('/regiones/:id', requireScope('catalog:write'), validate(idParamSchema, 'params'), dataController.removeRegion);
  router.get('/provincias/:id/comunas', validate(idParamSchema, 'params'), dataController.getComunasByProvinciaId);
  router.get('/provincias/:id', requireScope('catalog:write'), validate(idParamSchema, 'params'), dataController.getProvinciaById);
  router.post('/provincias', requireScope('catalog:write'), validate(provinciaSchema), dataController.createProvincia);
  router.put('/provincias/:id', requireScope('catalog:write'), validate(idParamSchema, 'params'), validate(updateProvinciaSchema), dataController.updateProvincia);
  router.delete('/provincias/:id', requireScope('catalog:write'), validate(idParamSchema, 'params'), dataController.removeProvincia);
  return router;
}

module.exports = createGeografiaRouter();
module.exports.createGeografiaRouter = createGeografiaRouter;
