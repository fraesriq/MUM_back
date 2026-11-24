const database = require('../../config/database');

const columns = 'id_coordenada, latitud, longitud, url_mapa, confirmada';
const writableFields = ['latitud', 'longitud', 'url_mapa', 'confirmada'];

function createCoordenadasRepository({ db = database } = {}) {
  const findAll = async ({ page, limit }) => {
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM coordenada');
    const [items] = await db.query(`SELECT ${columns} FROM coordenada ORDER BY id_coordenada ASC LIMIT ? OFFSET ?`, [limit, (page - 1) * limit]);
    return { items, total, page, limit };
  };
  const findById = async (id) => (await db.query(`SELECT ${columns} FROM coordenada WHERE id_coordenada = ?`, [id]))[0][0] || null;
  const create = async (data) => {
    const [result] = await db.query(`INSERT INTO coordenada (${writableFields.join(', ')}) VALUES (${writableFields.map(() => '?').join(', ')})`, writableFields.map((field) => data[field]));
    return findById(result.insertId);
  };
  const update = async (id, data) => {
    const fields = writableFields.filter((field) => data[field] !== undefined);
    if (!fields.length) throw new Error('La actualización requiere al menos un campo permitido.');
    await db.query(`UPDATE coordenada SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id_coordenada = ?`, [...fields.map((field) => data[field]), id]);
    return findById(id);
  };
  const remove = async (id) => (await db.query('DELETE FROM coordenada WHERE id_coordenada = ?', [id]))[0].affectedRows > 0;
  return { findAll, findById, create, update, remove };
}

module.exports = { createCoordenadasRepository, ...createCoordenadasRepository() };
