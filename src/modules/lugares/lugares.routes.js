const express = require('express');
const router = express.Router();
const controller = require('./lugares.controller');

router.get('/', controller.getAll);
router.get('/:slug', controller.getBySlug);

module.exports = router;