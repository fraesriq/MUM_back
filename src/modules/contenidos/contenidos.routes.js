const express = require('express');
const router = express.Router();
const controller = require('./contenidos.controller');
const validate = require('../../middlewares/validate.middleware');
const { requireScope } = require('../../auth/application.middleware');
const { createContenidoSchema, updateContenidoSchema, aprobarSchema, idParamSchema, listQuerySchema } = require('./contenidos.validation');

// Catálogo visible mediante acceso autenticado de la aplicación.
router.get('/aprobados', validate(listQuerySchema, 'query'), controller.getAprobados);

// Gestión del catálogo.
router.get('/', requireScope('catalog:write'), validate(listQuerySchema, 'query'), controller.getAll);
router.get('/:id', requireScope('catalog:write'), validate(idParamSchema, 'params'), controller.getById);
router.post('/', requireScope('catalog:write'), validate(createContenidoSchema), controller.create);
router.put('/:id', requireScope('catalog:write'), validate(idParamSchema, 'params'), validate(updateContenidoSchema), controller.update);
router.patch('/:id/aprobar', requireScope('catalog:write'), validate(idParamSchema, 'params'), validate(aprobarSchema), controller.aprobar);
router.delete('/:id', requireScope('catalog:write'), validate(idParamSchema, 'params'), controller.remove);

module.exports = router;
