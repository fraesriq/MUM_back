const db = require('../../config/database');

const archivoColumns = 'id_archivo, id_fuente, tipo, titulo, ruta, texto_alt, credito, permiso, en_galeria_general, orden_galeria';
const publicArchivoColumns = 'id_archivo, tipo, titulo, ruta, texto_alt, credito, orden_galeria';

exports.findAll = async ({ tipo, page, limit }) => {
  const conditions = ["permiso = 'autorizado'", 'en_galeria_general = 1'];
  const params = [];
  if (tipo) { conditions.push('tipo = ?'); params.push(tipo); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const [rows] = await db.query(
    `SELECT ${publicArchivoColumns} FROM archivo ${where} ORDER BY orden_galeria ASC, id_archivo ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM archivo ${where}`,
    params
  );
  return { items: rows, total, page, limit };
};

exports.findById = async (id) => {
  const [rows] = await db.query(
    `SELECT ${publicArchivoColumns} FROM archivo WHERE id_archivo = ? AND permiso = 'autorizado' AND en_galeria_general = 1`,
    [id]
  );
  return rows[0];
};

exports.findByIdForManagement = async (id) => {
  const [rows] = await db.query(`SELECT ${archivoColumns} FROM archivo WHERE id_archivo = ?`, [id]);
  return rows[0];
};

exports.create = async (data) => {
  const [result] = await db.query(
    `INSERT INTO archivo (id_fuente, tipo, titulo, ruta, texto_alt, credito, permiso, en_galeria_general, orden_galeria)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.id_fuente ?? null, data.tipo, data.titulo, data.ruta, data.texto_alt ?? null, data.credito,
      data.permiso ?? 'pendiente', data.en_galeria_general ?? false, data.orden_galeria ?? null]
  );
  const [rows] = await db.query(`SELECT ${archivoColumns} FROM archivo WHERE id_archivo = ?`, [result.insertId]);
  return rows[0];
};

exports.update = async (id, data) => {
  const fields = [];
  const params = [];
  for (const key of ['id_fuente', 'tipo', 'titulo', 'ruta', 'texto_alt', 'credito', 'permiso', 'en_galeria_general', 'orden_galeria']) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(data[key]);
    }
  }
  if (!fields.length) return exports.findById(id);
  params.push(id);
  await db.query(`UPDATE archivo SET ${fields.join(', ')} WHERE id_archivo = ?`, params);
  const [rows] = await db.query(`SELECT ${archivoColumns} FROM archivo WHERE id_archivo = ?`, [id]);
  return rows[0];
};

exports.remove = async (id) => {
  const [result] = await db.query('DELETE FROM archivo WHERE id_archivo = ?', [id]);
  return result.affectedRows > 0;
};
