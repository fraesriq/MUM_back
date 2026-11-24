const database = require('../../config/database');
const managementColumns = 'id_lugar, id_comuna, id_coordenada, id_fuente, slug, nombre, descripcion, orden, estado';
const writableFields = ['id_comuna', 'id_coordenada', 'id_fuente', 'slug', 'nombre', 'descripcion', 'orden'];

function createLugaresRepository({ db = database } = {}) {
  const findManagementAll = async ({ page, limit, estado, comuna_id }) => {
    const clauses = [];
    const params = [];
    if (estado) { clauses.push('estado = ?'); params.push(estado); }
    if (comuna_id) { clauses.push('id_comuna = ?'); params.push(comuna_id); }
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM lugar${where}`, params);
    const [items] = await db.query(`SELECT ${managementColumns} FROM lugar${where} ORDER BY id_lugar ASC LIMIT ? OFFSET ?`, [...params, limit, (page - 1) * limit]);
    return { items, total, page, limit };
  };
  const findManagementById = async (id) => (await db.query(`SELECT ${managementColumns} FROM lugar WHERE id_lugar = ?`, [id]))[0][0] || null;
  const create = async (data) => {
    const [result] = await db.query(
      `INSERT INTO lugar (${writableFields.join(', ')}, estado) VALUES (${writableFields.map(() => '?').join(', ')}, 'pendiente')`,
      writableFields.map((field) => data[field])
    );
    return findManagementById(result.insertId);
  };
  const update = async (id, data) => {
    const fields = writableFields.filter((field) => data[field] !== undefined);
    if (!fields.length) throw new Error('La actualización requiere al menos un campo permitido.');
    await db.query(`UPDATE lugar SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id_lugar = ?`, [...fields.map((field) => data[field]), id]);
    return findManagementById(id);
  };
  const setEstado = async (id, estado) => (await db.query(
    'UPDATE lugar SET estado = ? WHERE id_lugar = ?',
    [estado, id]
  ))[0].affectedRows > 0;
  const remove = async (id) => (await db.query(
    'DELETE FROM lugar WHERE id_lugar = ?',
    [id]
  ))[0].affectedRows > 0;
  const toArchivoAssociationDto = ({ id_lugar, id_archivo, es_portada_lugar, orden_carrusel }) => ({ id_lugar, id_archivo, es_portada_lugar: Boolean(es_portada_lugar), orden_carrusel });
  const findArchivoAssociation = async (id, archivoId) => {
    const row = (await db.query('SELECT id_lugar, id_archivo, es_portada_lugar, orden_carrusel FROM lugar_archivo WHERE id_lugar = ? AND id_archivo = ?', [id, archivoId]))[0][0];
    return row ? toArchivoAssociationDto(row) : null;
  };
  const upsertArchivoAssociation = async (id, archivoId, data) => {
    await db.query('INSERT INTO lugar_archivo (id_lugar, id_archivo, es_portada_lugar, orden_carrusel) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE es_portada_lugar = VALUES(es_portada_lugar), orden_carrusel = VALUES(orden_carrusel)', [id, archivoId, Number(data.es_portada_lugar), data.orden_carrusel]);
    return findArchivoAssociation(id, archivoId);
  };
  const removeArchivoAssociation = async (id, archivoId) => (await db.query('DELETE FROM lugar_archivo WHERE id_lugar = ? AND id_archivo = ?', [id, archivoId]))[0].affectedRows > 0;
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

  return { findAll, findBySlug, findManagementAll, findManagementById, create, update, setEstado, remove, findArchivoAssociation, upsertArchivoAssociation, removeArchivoAssociation };
}

module.exports = { createLugaresRepository, ...createLugaresRepository() };
