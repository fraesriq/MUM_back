const express = require('express');
const router = express.Router();
const controller = require('./galeria.controller');
const validate = require('../../middlewares/validate.middleware');
const { requireScope } = require('../../auth/application.middleware');
const { createGaleriaSchema, updateGaleriaSchema, idParamSchema, listQuerySchema } = require('./galeria.validation');

router.get('/', validate(listQuerySchema, 'query'), controller.getAll);
router.get('/:id', validate(idParamSchema, 'params'), controller.getById);
router.post('/', requireScope('catalog:write'), validate(createGaleriaSchema), controller.create);
router.put('/:id', requireScope('catalog:write'), validate(idParamSchema, 'params'), validate(updateGaleriaSchema), controller.update);
router.delete('/:id', requireScope('catalog:write'), validate(idParamSchema, 'params'), controller.remove);

module.exports = router;
