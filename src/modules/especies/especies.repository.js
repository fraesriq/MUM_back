const db = require('../../config/database');

// Listado con filtro opcional por categoría (slug) — RF03
exports.findAll = async ({ categoria } = {}) => {
  let sql = `
    SELECT e.id_especie, e.slug, e.nombre_comun, e.nombre_cientifico,
           e.descripcion, e.estado,
           c.id_categoria, c.nombre AS categoria, c.slug AS categoria_slug
    FROM especie e
    JOIN categoria c ON c.id_categoria = e.id_categoria
    WHERE e.estado = 'aprobado'
  `;
  const params = [];

  if (categoria) {
    sql += ' AND c.slug = ?';
    params.push(categoria);
  }

  sql += ' ORDER BY c.orden ASC, e.nombre_comun ASC';

  const [rows] = await db.query(sql, params);
  return rows;
};

// Ficha por slug con portada y carrusel multimedia — RF02, RF05
exports.findBySlug = async (slug) => {
  const [especies] = await db.query(
    `SELECT e.*, c.nombre AS categoria, c.slug AS categoria_slug,
            f.titulo AS fuente_titulo, f.autor_institucion AS fuente_autor
     FROM especie e
     JOIN categoria c ON c.id_categoria = e.id_categoria
     LEFT JOIN fuente f ON f.id_fuente = e.id_fuente
     WHERE e.slug = ? AND e.estado = 'aprobado'
     LIMIT 1`,
    [slug]
  );

  if (!especies.length) return null;
  const especie = especies[0];

  const [archivos] = await db.query(
    `SELECT a.id_archivo, a.tipo, a.titulo, a.ruta, a.texto_alt, a.credito,
            ea.es_portada_ficha, ea.orden_carrusel
     FROM especie_archivo ea
     JOIN archivo a ON a.id_archivo = ea.id_archivo
     WHERE ea.id_especie = ? AND a.permiso = 'autorizado'
     ORDER BY ea.es_portada_ficha DESC, ea.orden_carrusel ASC`,
    [especie.id_especie]
  );

  return { ...especie, archivos };
};