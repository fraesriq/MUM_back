const database = require('../../config/database');

const columns = 'id_categoria, nombre, slug, orden';
const writableFields = ['nombre', 'slug', 'orden'];

function createCategoriasRepository({ db = database } = {}) {
  const findAll = async () => (await db.query(
    `SELECT ${columns} FROM categoria ORDER BY orden ASC, id_categoria ASC`
  ))[0];

  const findById = async (id) => (await db.query(
    `SELECT ${columns} FROM categoria WHERE id_categoria = ?`,
    [id]
  ))[0][0] || null;

  const create = async ({ nombre, slug, orden }) => {
    const [result] = await db.query(
      'INSERT INTO categoria (nombre, slug, orden) VALUES (?, ?, ?)',
      [nombre, slug, orden]
    );
    return findById(result.insertId);
  };

  const update = async (id, data) => {
    const fields = writableFields.filter((field) => data[field] !== undefined);
    if (!fields.length) throw new Error('La actualización requiere al menos un campo permitido.');
    await db.query(
      `UPDATE categoria SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id_categoria = ?`,
      [...fields.map((field) => data[field]), id]
    );
    return findById(id);
  };

  const remove = async (id) => (await db.query(
    'DELETE FROM categoria WHERE id_categoria = ?',
    [id]
  ))[0].affectedRows > 0;

  return { findAll, findById, create, update, remove };
}

module.exports = { createCategoriasRepository, ...createCategoriasRepository() };
