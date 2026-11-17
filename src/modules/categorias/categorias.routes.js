const express = require('express');
const router = express.Router();
const controller = require('./categorias.controller');

router.get('/', controller.getAll);

module.exports = router;
