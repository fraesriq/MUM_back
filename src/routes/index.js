const express = require('express');
const router = express.Router();

const categoriasRoutes = require('../modules/categorias/categorias.routes');
const especiesRoutes = require('../modules/especies/especies.routes');
const lugaresRoutes = require('../modules/lugares/lugares.routes');
const galeriaRoutes    = require('../modules/galeria/galeria.routes');
const contenidosRoutes = require('../modules/contenidos/contenidos.routes');

router.use('/categorias', categoriasRoutes);
router.use('/especies', especiesRoutes);
router.use('/lugares', lugaresRoutes);
router.use('/galeria', galeriaRoutes);
router.use('/contenidos', contenidosRoutes);

module.exports = router;