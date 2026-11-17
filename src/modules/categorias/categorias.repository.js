const db = require('../../config/database');

exports.findAll = async () => {
  const [rows] = await db.query(
    `SELECT id_categoria, nombre, slug, orden
     FROM categoria
     ORDER BY orden ASC`
  );
  return rows;
};