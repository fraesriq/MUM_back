const database = require('../../config/database');

const safeColumns = 'id_fuente, titulo, tipo, autor_institucion, url, verificada';

function createFuentesRepository({ db = database } = {}) {
  const findAll = async () => {
    const [rows] = await db.query(`SELECT ${safeColumns} FROM fuente ORDER BY titulo ASC`);
    return rows;
  };

  const findById = async (id) => (await db.query(
    `SELECT ${safeColumns} FROM fuente WHERE id_fuente = ?`,
    [id]
  ))[0][0] || null;

  return { findAll, findById };
}

module.exports = { createFuentesRepository, ...createFuentesRepository() };
