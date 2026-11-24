const db = require('../../config/database');
const columns = 'id_especie, id_categoria, id_fuente, slug, nombre_comun, nombre_cientifico, descripcion, distribucion_geografica, habitat_ecosistema, alimentacion, habito, reproduccion, estado';
const writableFields = ['id_categoria', 'id_fuente', 'slug', 'nombre_comun', 'nombre_cientifico', 'descripcion', 'distribucion_geografica', 'habitat_ecosistema', 'alimentacion', 'habito', 'reproduccion'];

function createEspeciesRepository({ database = db } = {}) {
  const findManagementAll = async ({ page, limit, estado, categoria_id }) => {
    const clauses = [];
    const params = [];
    if (estado) { clauses.push('estado = ?'); params.push(estado); }
    if (categoria_id) { clauses.push('id_categoria = ?'); params.push(categoria_id); }
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const [[{ total }]] = await database.query(`SELECT COUNT(*) AS total FROM especie${where}`, params);
    const [items] = await database.query(`SELECT ${columns} FROM especie${where} ORDER BY id_especie ASC LIMIT ? OFFSET ?`, [...params, limit, (page - 1) * limit]);
    return { items, total, page, limit };
  };
  const findManagementById = async (id) => (await database.query(`SELECT ${columns} FROM especie WHERE id_especie = ?`, [id]))[0][0] || null;
  const create = async (data) => {
    const values = writableFields.map((field) => data[field] ?? null);
    const [result] = await database.query(`INSERT INTO especie (${writableFields.join(', ')}, estado) VALUES (${writableFields.map(() => '?').join(', ')}, 'pendiente')`, values);
    return findManagementById(result.insertId);
  };
  const update = async (id, data) => {
    const fields = writableFields.filter((field) => data[field] !== undefined);
    if (!fields.length) throw new Error('La actualización requiere al menos un campo permitido.');
    await database.query(`UPDATE especie SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id_especie = ?`, [...fields.map((field) => data[field]), id]);
    return findManagementById(id);
  };
  const setEstado = async (id, estado) => (await database.query(
    'UPDATE especie SET estado = ? WHERE id_especie = ?',
    [estado, id]
  ))[0].affectedRows > 0;
  const remove = async (id) => (await database.query(
    'DELETE FROM especie WHERE id_especie = ?',
    [id]
  ))[0].affectedRows > 0;
  return { findManagementAll, findManagementById, create, update, setEstado, remove };
}

// Listado con filtro opcional por categoría (slug) — RF03
async function findAll({ categoria } = {}) {
  let sql = `
    SELECT e.slug, e.nombre_comun, e.nombre_cientifico, e.descripcion,
           c.nombre AS categoria, c.slug AS categoria_slug
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
}

// Ficha por slug con portada y carrusel multimedia — RF02, RF05
async function findBySlug(slug) {
  const [especies] = await db.query(
    `SELECT e.slug, e.nombre_comun, e.nombre_cientifico, e.descripcion,
             e.distribucion_geografica, e.habitat_ecosistema, e.alimentacion,
             e.habito, e.reproduccion, c.nombre AS categoria, c.slug AS categoria_slug,
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
      WHERE ea.id_especie = (SELECT id_especie FROM especie WHERE slug = ?) AND a.permiso = 'autorizado'
     ORDER BY ea.es_portada_ficha DESC, ea.orden_carrusel ASC`,
    [slug]
  );

  return { ...especie, archivos };
}

module.exports = { createEspeciesRepository, findAll, findBySlug, ...createEspeciesRepository() };
