const express = require('express');
const router = express.Router();
const controller = require('./contenidos.controller');
const validate = require('../../middlewares/validate.middleware');
const { createContenidoSchema, updateContenidoSchema, aprobarSchema, idParamSchema, listQuerySchema } = require('./contenidos.validation');

// Público: solo aprobados
router.get('/aprobados', validate(listQuerySchema, 'query'), controller.getAprobados);

// Admin
router.get('/', validate(listQuerySchema, 'query'), controller.getAll);
router.get('/:id', validate(idParamSchema, 'params'), controller.getById);
router.post('/', validate(createContenidoSchema), controller.create);
router.put('/:id', validate(idParamSchema, 'params'), validate(updateContenidoSchema), controller.update);
router.patch('/:id/aprobar', validate(idParamSchema, 'params'), validate(aprobarSchema), controller.aprobar);
router.delete('/:id', validate(idParamSchema, 'params'), controller.remove);

module.exports = router;