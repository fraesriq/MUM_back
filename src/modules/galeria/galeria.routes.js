const express = require('express');
const router = express.Router();
const controller = require('./galeria.controller');
const validate = require('../../middlewares/validate.middleware');
const { idParamSchema, listQuerySchema } = require('./galeria.validation');

router.get('/', validate(listQuerySchema, 'query'), controller.getAll);
router.get('/:id', validate(idParamSchema, 'params'), controller.getById);

module.exports = router;
