const database = require('../../config/database');

function createLugaresRepository({ db = database } = {}) {
  // Listado de los 8 sectores con su comuna, provincia, región y coordenada — RF04, RN03
  const findAll = async () => {
    const [rows] = await db.query(
      `SELECT l.slug, l.nombre, l.descripcion, l.orden,
              c.nombre AS comuna, p.nombre AS provincia, r.nombre AS region,
              co.latitud, co.longitud, co.url_mapa,
              co.confirmada AS coordenada_confirmada
       FROM lugar l
       JOIN comuna c ON c.id_comuna = l.id_comuna
       JOIN provincia p ON p.id_provincia = c.id_provincia
       JOIN region r ON r.id_region = p.id_region
       LEFT JOIN coordenada co ON co.id_coordenada = l.id_coordenada
       WHERE l.estado = 'aprobado'
       ORDER BY l.orden ASC`
    );
    return rows;
  };

  // Detalle de un sector con coordenada confirmada y galería — RF04, RN03, RF05
  const findBySlug = async (slug) => {
    const [lugares] = await db.query(
      `SELECT l.slug, l.nombre, l.descripcion, l.orden,
              c.nombre AS comuna, p.nombre AS provincia, r.nombre AS region,
              co.latitud, co.longitud, co.url_mapa, co.confirmada AS coordenada_confirmada,
              f.titulo AS fuente_titulo, f.autor_institucion AS fuente_autor
       FROM lugar l
       JOIN comuna c ON c.id_comuna = l.id_comuna
       JOIN provincia p ON p.id_provincia = c.id_provincia
       JOIN region r ON r.id_region = p.id_region
       LEFT JOIN coordenada co ON co.id_coordenada = l.id_coordenada
       LEFT JOIN fuente f ON f.id_fuente = l.id_fuente
       WHERE l.slug = ? AND l.estado = 'aprobado'
       LIMIT 1`,
      [slug]
    );

    if (!lugares.length) return null;
    const lugar = lugares[0];

    // RN03: solo exponer lat/long si la coordenada está confirmada
    if (!lugar.coordenada_confirmada) {
      lugar.latitud = null;
      lugar.longitud = null;
      lugar.url_mapa = null;
    }

    const [archivos] = await db.query(
      `SELECT a.id_archivo, a.tipo, a.titulo, a.ruta, a.texto_alt, a.credito,
              la.es_portada_lugar, la.orden_carrusel
       FROM lugar_archivo la
       JOIN archivo a ON a.id_archivo = la.id_archivo
        WHERE la.id_lugar = (SELECT id_lugar FROM lugar WHERE slug = ?) AND a.permiso = 'autorizado'
       ORDER BY la.es_portada_lugar DESC, la.orden_carrusel ASC`,
      [slug]
    );

    return { ...lugar, archivos };
  };

  return { findAll, findBySlug };
}

module.exports = { createLugaresRepository, ...createLugaresRepository() };
