const db = require('../../config/database');

exports.findAll = async ({ estado, page, limit }) => {
  const conditions = [];
  const params = [];
  if (estado) { conditions.push('estado = ?'); params.push(estado); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const [rows] = await db.query(
    `SELECT * FROM contenidos ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM contenidos ${where}`, params
  );
  return { items: rows, total, page, limit };
};

// Solo aprobados (endpoint público)
exports.findAllAprobados = async ({ page, limit }) => {
  const offset = (page - 1) * limit;
  const [rows] = await db.query(
    `SELECT id, titulo, resumen, cuerpo, enlace_app, created_at
     FROM contenidos WHERE estado = 'aprobado'
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM contenidos WHERE estado = 'aprobado'`
  );
  return { items: rows, total, page, limit };
};

exports.findById = async (id) => {
  const [rows] = await db.query('SELECT * FROM contenidos WHERE id = ?', [id]);
  return rows[0];
};

exports.create = async (data) => {
  const [result] = await db.query(
    `INSERT INTO contenidos (titulo, cuerpo, resumen, autor_id, estado, enlace_app)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.titulo, data.cuerpo, data.resumen ?? null, data.autor_id ?? null,
     data.estado ?? 'pendiente', data.enlace_app ?? null]
  );
  return exports.findById(result.insertId);
};

exports.update = async (id, data) => {
  const fields = [];
  const params = [];
  for (const key of ['titulo', 'cuerpo', 'resumen', 'autor_id', 'estado', 'enlace_app']) {
    if (data[key] !== undefined) { fields.push(`${key} = ?`); params.push(data[key]); }
  }
  if (!fields.length) return exports.findById(id);
  params.push(id);
  await db.query(`UPDATE contenidos SET ${fields.join(', ')} WHERE id = ?`, params);
  return exports.findById(id);
};

exports.remove = async (id) => {
  const [result] = await db.query('DELETE FROM contenidos WHERE id = ?', [id]);
  return result.affectedRows > 0;
};