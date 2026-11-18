const express = require('express');
const router = express.Router();

const categoriasRoutes = require('../modules/categorias/categorias.routes');
const especiesRoutes = require('../modules/especies/especies.routes');
const lugaresRoutes = require('../modules/lugares/lugares.routes');

router.use('/categorias', categoriasRoutes);
router.use('/especies', especiesRoutes);
router.use('/lugares', lugaresRoutes);

module.exports = router;