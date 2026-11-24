const database = require('../../config/database');

function createGeografiaRepository({ db = database } = {}) {
  const findRegiones = async () => (await db.query(
    'SELECT id_region, nombre FROM region ORDER BY nombre ASC'
  ))[0];
  const findRegionById = async (id) => (await db.query(
    'SELECT id_region FROM region WHERE id_region = ?',
    [id]
  ))[0][0] || null;
  const findProvinciasByRegionId = async (regionId) => (await db.query(
    'SELECT id_provincia, id_region, nombre FROM provincia WHERE id_region = ? ORDER BY nombre ASC',
    [regionId]
  ))[0];
  const findProvinciaById = async (id) => (await db.query(
    'SELECT id_provincia FROM provincia WHERE id_provincia = ?',
    [id]
  ))[0][0] || null;
  const findComunasByProvinciaId = async (provinciaId) => (await db.query(
    'SELECT id_comuna, id_provincia, nombre FROM comuna WHERE id_provincia = ? ORDER BY nombre ASC',
    [provinciaId]
  ))[0];

  return { findRegiones, findRegionById, findProvinciasByRegionId, findProvinciaById, findComunasByProvinciaId };
}

module.exports = { createGeografiaRepository, ...createGeografiaRepository() };
