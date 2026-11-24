const database = require('../../config/database');

function createGeografiaRepository({ db = database } = {}) {
  const findRegiones = async () => (await db.query(
    'SELECT id_region, nombre FROM region ORDER BY nombre ASC'
  ))[0];
  const findRegionById = async (id) => (await db.query(
    'SELECT id_region, nombre FROM region WHERE id_region = ?',
    [id]
  ))[0][0] || null;
  const findProvinciasByRegionId = async (regionId) => (await db.query(
    'SELECT id_provincia, id_region, nombre FROM provincia WHERE id_region = ? ORDER BY nombre ASC',
    [regionId]
  ))[0];
  const findProvinciaById = async (id) => (await db.query(
    'SELECT id_provincia, id_region, nombre FROM provincia WHERE id_provincia = ?',
    [id]
  ))[0][0] || null;
  const findComunasByProvinciaId = async (provinciaId) => (await db.query(
    'SELECT id_comuna, id_provincia, nombre FROM comuna WHERE id_provincia = ? ORDER BY nombre ASC',
    [provinciaId]
  ))[0];
  const createRegion = async ({ nombre }) => {
    const [result] = await db.query('INSERT INTO region (nombre) VALUES (?)', [nombre]);
    return findRegionById(result.insertId);
  };
  const updateRegion = async (id, { nombre }) => {
    await db.query('UPDATE region SET nombre = ? WHERE id_region = ?', [nombre, id]);
    return findRegionById(id);
  };
  const removeRegion = async (id) => (await db.query('DELETE FROM region WHERE id_region = ?', [id]))[0].affectedRows > 0;
  const createProvincia = async ({ id_region, nombre }) => {
    const [result] = await db.query('INSERT INTO provincia (id_region, nombre) VALUES (?, ?)', [id_region, nombre]);
    return findProvinciaById(result.insertId);
  };
  const updateProvincia = async (id, data) => {
    const fields = ['id_region', 'nombre'].filter((field) => data[field] !== undefined);
    if (!fields.length) throw new Error('La actualización requiere al menos un campo permitido.');
    await db.query(`UPDATE provincia SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id_provincia = ?`, [...fields.map((field) => data[field]), id]);
    return findProvinciaById(id);
  };
  const removeProvincia = async (id) => (await db.query('DELETE FROM provincia WHERE id_provincia = ?', [id]))[0].affectedRows > 0;

  return { findRegiones, findRegionById, findProvinciasByRegionId, findProvinciaById, findComunasByProvinciaId, createRegion, updateRegion, removeRegion, createProvincia, updateProvincia, removeProvincia };
}

module.exports = { createGeografiaRepository, ...createGeografiaRepository() };
