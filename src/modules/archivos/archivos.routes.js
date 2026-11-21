const express = require('express');
const controller = require('./archivos.controller');
const validate = require('../../middlewares/validate.middleware');
const { requireScope } = require('../../auth/application.middleware');
const { uploadSchema, confirmUploadSchema, idParamSchema, listQuerySchema, updateArchivoSchema, cleanupSchema } = require('./archivos.validation');

const router = express.Router();
router.use(requireScope('catalog:write'));
router.post('/cargas', validate(uploadSchema), controller.requestUpload);
router.post('/cargas/confirmar', validate(confirmUploadSchema), controller.confirmUpload);
router.post('/limpieza', validate(cleanupSchema), controller.processCleanup);
router.get('/', validate(listQuerySchema, 'query'), controller.getAll);
router.get('/:id', validate(idParamSchema, 'params'), controller.getById);
router.put('/:id', validate(idParamSchema, 'params'), validate(updateArchivoSchema), controller.update);
router.delete('/:id', validate(idParamSchema, 'params'), controller.remove);

module.exports = router;
