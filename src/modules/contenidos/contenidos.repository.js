const db = require('../../config/database');

const contenidoColumns = 'id_contenido, id_fuente, seccion, titulo, texto, orden, estado';

exports.findAll = async ({ estado, seccion, page, limit }) => {
  const conditions = [];
  const params = [];
  if (estado) { conditions.push('estado = ?'); params.push(estado); }
  if (seccion) { conditions.push('seccion = ?'); params.push(seccion); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const [rows] = await db.query(
    `SELECT ${contenidoColumns} FROM contenido ${where} ORDER BY orden ASC, id_contenido ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM contenido ${where}`, params
  );
  return { items: rows, total, page, limit };
};

exports.findAllAprobados = async ({ seccion, page, limit }) => {
  const conditions = ["estado = 'aprobado'"];
  const params = [];
  if (seccion) { conditions.push('seccion = ?'); params.push(seccion); }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;
  const [rows] = await db.query(
    `SELECT ${contenidoColumns} FROM contenido ${where}
     ORDER BY orden ASC, id_contenido ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM contenido ${where}`,
    params
  );
  return { items: rows, total, page, limit };
};

exports.findById = async (id) => {
  const [rows] = await db.query(`SELECT ${contenidoColumns} FROM contenido WHERE id_contenido = ?`, [id]);
  return rows[0];
};

exports.create = async (data) => {
  const [result] = await db.query(
    `INSERT INTO contenido (id_fuente, seccion, titulo, texto, orden, estado)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.id_fuente ?? null, data.seccion, data.titulo, data.texto, data.orden,
      data.estado ?? 'pendiente']
  );
  return exports.findById(result.insertId);
};

exports.update = async (id, data) => {
  const fields = [];
  const params = [];
  for (const key of ['id_fuente', 'seccion', 'titulo', 'texto', 'orden', 'estado']) {
    if (data[key] !== undefined) { fields.push(`${key} = ?`); params.push(data[key]); }
  }
  if (!fields.length) return exports.findById(id);
  params.push(id);
  await db.query(`UPDATE contenido SET ${fields.join(', ')} WHERE id_contenido = ?`, params);
  return exports.findById(id);
};

exports.remove = async (id) => {
  const [result] = await db.query('DELETE FROM contenido WHERE id_contenido = ?', [id]);
  return result.affectedRows > 0;
};
