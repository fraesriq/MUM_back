const express = require('express');
const router = express.Router();

const categoriasRoutes = require('../modules/categorias/categorias.routes');
const especiesRoutes = require('../modules/especies/especies.routes');
const lugaresRoutes = require('../modules/lugares/lugares.routes');
const galeriaRoutes    = require('../modules/galeria/galeria.routes');
const contenidosRoutes = require('../modules/contenidos/contenidos.routes');
const archivosRoutes = require('../modules/archivos/archivos.routes');
const fuentesRoutes = require('../modules/fuentes/fuentes.routes');
const geografiaRoutes = require('../modules/geografia/geografia.routes');

router.use('/categorias', categoriasRoutes);
router.use('/especies', especiesRoutes);
router.use('/lugares', lugaresRoutes);
router.use('/galeria', galeriaRoutes);
router.use('/contenidos', contenidosRoutes);
router.use('/archivos', archivosRoutes);
router.use('/fuentes', fuentesRoutes);
router.use('/', geografiaRoutes);

module.exports = router;
