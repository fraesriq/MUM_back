const express = require('express');
const router = express.Router();
const controller = require('./galeria.controller');
const validate = require('../../middlewares/validate.middleware');
const { createGaleriaSchema, updateGaleriaSchema, idParamSchema, listQuerySchema } = require('./galeria.validation');

router.get('/', validate(listQuerySchema, 'query'), controller.getAll);
router.get('/:id', validate(idParamSchema, 'params'), controller.getById);
router.post('/', validate(createGaleriaSchema), controller.create);
router.put('/:id', validate(idParamSchema, 'params'), validate(updateGaleriaSchema), controller.update);
router.delete('/:id', validate(idParamSchema, 'params'), controller.remove);

module.exports = router;