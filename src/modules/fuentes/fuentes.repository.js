const database = require('../../config/database');

const safeColumns = 'id_fuente, titulo, tipo, autor_institucion, url, verificada';
const writableFields = ['titulo', 'tipo', 'autor_institucion', 'archivo_original', 'url', 'verificada'];

function createFuentesRepository({ db = database } = {}) {
  const findAll = async () => {
    const [rows] = await db.query(`SELECT ${safeColumns} FROM fuente ORDER BY titulo ASC`);
    return rows;
  };

  const findById = async (id) => (await db.query(
    `SELECT ${safeColumns} FROM fuente WHERE id_fuente = ?`,
    [id]
  ))[0][0] || null;

  const create = async (data) => {
    const [result] = await db.query(
      `INSERT INTO fuente (${writableFields.join(', ')}) VALUES (${writableFields.map(() => '?').join(', ')})`,
      writableFields.map((field) => data[field])
    );
    return findById(result.insertId);
  };

  const update = async (id, data) => {
    const fields = writableFields.filter((field) => data[field] !== undefined);
    if (!fields.length) throw new Error('La actualización requiere al menos un campo permitido.');
    await db.query(
      `UPDATE fuente SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id_fuente = ?`,
      [...fields.map((field) => data[field]), id]
    );
    return findById(id);
  };

  const remove = async (id) => (await db.query(
    'DELETE FROM fuente WHERE id_fuente = ?',
    [id]
  ))[0].affectedRows > 0;

  return { findAll, findById, create, update, remove };
}

module.exports = { createFuentesRepository, ...createFuentesRepository() };
