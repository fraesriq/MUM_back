const db = require('../../config/database');

// Listado de los 8 sectores con su comuna, región y coordenada — RF04, RN03
exports.findAll = async () => {
  const [rows] = await db.query(
    `SELECT l.id_lugar, l.slug, l.nombre, l.descripcion, l.orden, l.estado,
            ci.nombre AS ciudad, r.nombre AS region,
            co.id_coordenada, co.latitud, co.longitud, co.url_mapa,
            co.confirmada AS coordenada_confirmada
     FROM lugar l
     JOIN ciudad ci ON ci.id_ciudad = l.id_ciudad
     JOIN region r ON r.id_region = ci.id_region
     LEFT JOIN coordenada co ON co.id_coordenada = l.id_coordenada
     WHERE l.estado = 'aprobado'
     ORDER BY l.orden ASC`
  );
  return rows;
};

// Detalle de un sector con coordenada confirmada y galería — RF04, RN03, RF05
exports.findBySlug = async (slug) => {
  const [lugares] = await db.query(
    `SELECT l.*, ci.nombre AS ciudad, r.nombre AS region,
            co.latitud, co.longitud, co.url_mapa, co.confirmada AS coordenada_confirmada,
            f.titulo AS fuente_titulo, f.autor_institucion AS fuente_autor
     FROM lugar l
     JOIN ciudad ci ON ci.id_ciudad = l.id_ciudad
     JOIN region r ON r.id_region = ci.id_region
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
     WHERE la.id_lugar = ? AND a.permiso = 'autorizado'
     ORDER BY la.es_portada_lugar DESC, la.orden_carrusel ASC`,
    [lugar.id_lugar]
  );

  return { ...lugar, archivos };
};