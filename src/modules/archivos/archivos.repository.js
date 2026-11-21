const database = require('../../config/database');

const columns = 'id_archivo, id_fuente, tipo, titulo, ruta, texto_alt, credito, permiso, en_galeria_general, orden_galeria';
const publicColumns = 'id_archivo, tipo, titulo, ruta, texto_alt, credito, orden_galeria';

function createArchivosRepository({ db = database, now = () => new Date() } = {}) {
  const findAll = async ({ tipo, page, limit }) => {
    const conditions = [];
    const params = [];
    if (tipo) { conditions.push('tipo = ?'); params.push(tipo); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await db.query(`SELECT ${columns} FROM archivo ${where} ORDER BY id_archivo ASC LIMIT ? OFFSET ?`, [...params, limit, (page - 1) * limit]);
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM archivo ${where}`, params);
    return { items: rows, total, page, limit };
  };
  const findById = async (id) => (await db.query(`SELECT ${columns} FROM archivo WHERE id_archivo = ?`, [id]))[0][0];
  const findByRuta = async (ruta) => (await db.query(`SELECT ${columns} FROM archivo WHERE ruta = ?`, [ruta]))[0][0];
  const findPublicGallery = async ({ tipo, page, limit }) => {
    const conditions = ["permiso = 'autorizado'", 'en_galeria_general = 1'];
    const params = [];
    if (tipo) { conditions.push('tipo = ?'); params.push(tipo); }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const [rows] = await db.query(`SELECT ${publicColumns} FROM archivo ${where} ORDER BY orden_galeria ASC, id_archivo ASC LIMIT ? OFFSET ?`, [...params, limit, (page - 1) * limit]);
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM archivo ${where}`, params);
    return { items: rows, total, page, limit };
  };
  const findPublicGalleryById = async (id) => (await db.query(`SELECT ${publicColumns} FROM archivo WHERE id_archivo = ? AND permiso = 'autorizado' AND en_galeria_general = 1`, [id]))[0][0];
  const create = async (data) => {
    const [result] = await db.query('INSERT INTO archivo (id_fuente, tipo, titulo, ruta, texto_alt, credito, permiso, en_galeria_general, orden_galeria) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [data.id_fuente ?? null, data.tipo, data.titulo, data.ruta, data.texto_alt ?? null, data.credito, data.permiso, data.en_galeria_general, data.orden_galeria ?? null]);
    return findById(result.insertId);
  };
  const createUploadGrant = async ({ objectKey, applicationClientId, tipo, contentType, size, expiresAt }) => withTransaction(async (connection) => {
    await connection.query('INSERT INTO r2_cleanup_tasks (object_key, reason) VALUES (?, ?)', [objectKey, 'carga_pendiente']);
    await connection.query('INSERT INTO r2_upload_grants (object_key, application_public_id, tipo, content_type, size_bytes, expires_at) VALUES (?, ?, ?, ?, ?, ?)', [objectKey, applicationClientId, tipo, contentType, size, expiresAt]);
  });
  const findUploadGrant = async (objectKey) => (await db.query('SELECT object_key, application_public_id, tipo, content_type, size_bytes, expires_at, confirmed_at FROM r2_upload_grants WHERE object_key = ?', [objectKey]))[0][0];
  const recordCleanupTask = async ({ objectKey, reason, lastError = null }) => {
    const [result] = await db.query('UPDATE r2_cleanup_tasks SET reason = ?, attempts = attempts + 1, last_error = ? WHERE object_key = ?', [reason, lastError, objectKey]);
    return result.affectedRows > 0;
  };
  const completeCleanupTask = async (objectKey) => (await db.query('DELETE FROM r2_cleanup_tasks WHERE object_key = ?', [objectKey]))[0].affectedRows > 0;
  const listPendingCleanupTasks = async (limit) => {
    const [rows] = await db.query(
      `SELECT t.object_key, t.reason
       FROM r2_cleanup_tasks t
       LEFT JOIN archivo a ON a.ruta = t.object_key
        LEFT JOIN r2_upload_grants g ON g.object_key = t.object_key
       WHERE a.id_archivo IS NULL
          AND (g.object_key IS NULL OR g.confirmed_at IS NOT NULL OR g.expires_at < CURRENT_TIMESTAMP)
       ORDER BY t.updated_at ASC
       LIMIT ?`,
      [limit]
    );
    return rows;
  };
  const update = async (id, data) => {
    const fields = [];
    const params = [];
    for (const key of ['id_fuente', 'titulo', 'texto_alt', 'credito', 'permiso', 'en_galeria_general', 'orden_galeria']) {
      if (data[key] !== undefined) { fields.push(`${key} = ?`); params.push(data[key]); }
    }
    if (!fields.length) return findById(id);
    await db.query(`UPDATE archivo SET ${fields.join(', ')} WHERE id_archivo = ?`, [...params, id]);
    return findById(id);
  };
  const withTransaction = async (work) => {
    const connection = await db.getConnection();
    try { await connection.beginTransaction(); const result = await work(connection); await connection.commit(); return result; } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  };
  const insertWithGrantConfirmation = async ({ objectKey, applicationClientId, tipo, contentType, size, metadata }) => withTransaction(async (connection) => {
    const [grants] = await connection.query('SELECT object_key, application_public_id, tipo, content_type, size_bytes, expires_at, confirmed_at FROM r2_upload_grants WHERE object_key = ? FOR UPDATE', [objectKey]);
    const grant = grants[0];
    if (!grant) return { state: 'missing_grant' };
    if (grant.application_public_id !== applicationClientId || grant.tipo !== tipo || grant.content_type !== contentType || Number(grant.size_bytes) !== size) return { state: 'invalid_grant' };
    const [existingRows] = await connection.query(`SELECT ${columns} FROM archivo WHERE ruta = ? FOR UPDATE`, [objectKey]);
    const existing = existingRows[0];
    if (existing) {
      if (!grant.confirmed_at || existing.tipo !== tipo) return { state: 'conflict' };
      await connection.query('DELETE FROM r2_cleanup_tasks WHERE object_key = ?', [objectKey]);
      return { state: 'existing', item: existing };
    }
    if (grant.confirmed_at || new Date(grant.expires_at) < now()) return { state: 'expired_grant' };
    const [result] = await connection.query('INSERT INTO archivo (id_fuente, tipo, titulo, ruta, texto_alt, credito, permiso, en_galeria_general, orden_galeria) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [metadata.id_fuente ?? null, tipo, metadata.titulo, objectKey, metadata.texto_alt ?? null, metadata.credito, metadata.permiso, metadata.en_galeria_general, metadata.orden_galeria ?? null]);
    await connection.query('UPDATE r2_upload_grants SET confirmed_at = CURRENT_TIMESTAMP WHERE object_key = ?', [objectKey]);
    await connection.query('DELETE FROM r2_cleanup_tasks WHERE object_key = ?', [objectKey]);
    const [rows] = await connection.query(`SELECT ${columns} FROM archivo WHERE id_archivo = ?`, [result.insertId]);
    return { state: 'created', item: rows[0] };
  });
  const deleteWithCleanup = async (id) => withTransaction(async (connection) => {
    const [rows] = await connection.query(`SELECT ${columns} FROM archivo WHERE id_archivo = ? FOR UPDATE`, [id]);
    const item = rows[0];
    if (!item) return null;
    await connection.query('INSERT INTO r2_cleanup_tasks (object_key, reason) VALUES (?, ?)', [item.ruta, 'archivo_eliminado']);
    const [result] = await connection.query('DELETE FROM archivo WHERE id_archivo = ?', [id]);
    if (!result.affectedRows) return null;
    return item;
  });
  return { findAll, findById, findByRuta, findPublicGallery, findPublicGalleryById, create, createUploadGrant, findUploadGrant, insertWithGrantConfirmation, recordCleanupTask, completeCleanupTask, listPendingCleanupTasks, update, deleteWithCleanup };
}

module.exports = { createArchivosRepository, ...createArchivosRepository() };
