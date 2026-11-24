const express = require('express');
const controller = require('./geografia.controller');
const validate = require('../../middlewares/validate.middleware');
const { idParamSchema } = require('./geografia.validation');

function createGeografiaRouter({ dataController = controller } = {}) {
  const router = express.Router();
  router.get('/regiones', dataController.getRegiones);
  router.get('/regiones/:id/provincias', validate(idParamSchema, 'params'), dataController.getProvinciasByRegionId);
  router.get('/provincias/:id/comunas', validate(idParamSchema, 'params'), dataController.getComunasByProvinciaId);
  return router;
}

module.exports = createGeografiaRouter();
module.exports.createGeografiaRouter = createGeografiaRouter;
