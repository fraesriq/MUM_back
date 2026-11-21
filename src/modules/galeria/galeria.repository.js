const db = require('../../config/database');

exports.findAll = async ({ tipo_archivo, activo, page, limit }) => {
  const conditions = [];
  const params = [];
  if (tipo_archivo) { conditions.push('tipo_archivo = ?'); params.push(tipo_archivo); }
  if (activo !== undefined) { conditions.push('activo = ?'); params.push(Number(activo)); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const [rows] = await db.query(
    `SELECT * FROM galeria ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM galeria ${where}`,
    params
  );
  return { items: rows, total, page, limit };
};

exports.findById = async (id) => {
  const [rows] = await db.query('SELECT * FROM galeria WHERE id = ?', [id]);
  return rows[0];
};

exports.create = async (data) => {
  const [result] = await db.query(
    `INSERT INTO galeria (titulo, descripcion, archivo_url, tipo_archivo, mime_type, tamanio_bytes, activo)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.titulo, data.descripcion ?? null, data.archivo_url, data.tipo_archivo,
     data.mime_type ?? null, data.tamanio_bytes ?? null, data.activo ? 1 : 0]
  );
  return exports.findById(result.insertId);
};

exports.update = async (id, data) => {
  const fields = [];
  const params = [];
  for (const key of ['titulo', 'descripcion', 'archivo_url', 'tipo_archivo', 'mime_type', 'tamanio_bytes', 'activo']) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(key === 'activo' ? (data[key] ? 1 : 0) : data[key]);
    }
  }
  if (!fields.length) return exports.findById(id);
  params.push(id);
  await db.query(`UPDATE galeria SET ${fields.join(', ')} WHERE id = ?`, params);
  return exports.findById(id);
};

exports.remove = async (id) => {
  const [result] = await db.query('DELETE FROM galeria WHERE id = ?', [id]);
  return result.affectedRows > 0;
};