const db = require('../config/database');
const { secretMatches } = require('./credentials');

async function authenticateClient(clientId, clientSecret) {
  const [clients] = await db.query(
    'SELECT id, public_id, status FROM api_clients WHERE public_id = ? LIMIT 1',
    [clientId]
  );
  const client = clients[0];
  if (!client || client.status !== 'ACTIVE') return null;
  const [secrets] = await db.query(
    'SELECT id, secret_digest FROM api_client_secrets WHERE client_id = ? AND revoked_at IS NULL',
    [client.id]
  );
  if (!secrets.some((secret) => secretMatches(clientSecret, secret.secret_digest))) return null;
  return client;
}

async function getClientScopes(clientId) {
  const [scopes] = await db.query(
    `SELECT s.code
     FROM api_client_scopes cs
     JOIN api_scopes s ON s.id = cs.scope_id
     WHERE cs.client_id = ?`,
    [clientId]
  );
  return scopes.map((scope) => scope.code);
}

async function getActiveClientScopes(publicId) {
  const [clients] = await db.query(
    'SELECT id, public_id, status FROM api_clients WHERE public_id = ? LIMIT 1',
    [publicId]
  );
  const client = clients[0];
  if (!client || client.status !== 'ACTIVE') return null;
  return { client, scopes: await getClientScopes(client.id) };
}

async function createAdminClient(executor, publicId, name) {
  const [result] = await executor.query(
    "INSERT INTO api_clients (public_id, name, status) VALUES (?, ?, 'ACTIVE')",
    [publicId, name]
  );
  return result;
}

async function createAdminClientSecret(executor, clientId, secretDigest) {
  await executor.query(
    'INSERT INTO api_client_secrets (client_id, secret_digest) VALUES (?, ?)',
    [clientId, secretDigest]
  );
}

async function listAdminClients(executor = db) {
  const [clients] = await executor.query(
    `SELECT c.public_id, c.name, c.status, c.created_at, c.updated_at,
            COUNT(s.id) AS active_secret_count
     FROM api_clients c
     LEFT JOIN api_client_secrets s ON s.client_id = c.id AND s.revoked_at IS NULL
     GROUP BY c.id, c.public_id, c.name, c.status, c.created_at, c.updated_at
     ORDER BY c.created_at ASC`
  );
  return clients;
}

async function findAdminClientForUpdate(executor, publicId) {
  const [clients] = await executor.query(
    'SELECT id, public_id, status FROM api_clients WHERE public_id = ? FOR UPDATE',
    [publicId]
  );
  return clients[0] || null;
}

async function findActiveSecretsForUpdate(executor, clientId) {
  const [secrets] = await executor.query(
    'SELECT id FROM api_client_secrets WHERE client_id = ? AND revoked_at IS NULL FOR UPDATE',
    [clientId]
  );
  return secrets;
}

async function revokeActiveClientSecret(executor, secretId, clientId) {
  const [result] = await executor.query(
    'UPDATE api_client_secrets SET revoked_at = NOW() WHERE id = ? AND client_id = ? AND revoked_at IS NULL',
    [secretId, clientId]
  );
  return result;
}

async function updateAdminClientStatus(executor, clientId, status) {
  await executor.query('UPDATE api_clients SET status = ? WHERE id = ?', [status, clientId]);
}

async function revokeActiveClientSecrets(executor, clientId) {
  await executor.query(
    'UPDATE api_client_secrets SET revoked_at = NOW() WHERE client_id = ? AND revoked_at IS NULL',
    [clientId]
  );
}

async function findScopeForUpdate(executor, code) {
  const [scopes] = await executor.query('SELECT id, code FROM api_scopes WHERE code = ? FOR UPDATE', [code]);
  return scopes[0] || null;
}

async function assignScopeToClient(executor, clientId, scopeId) {
  await executor.query(
    'INSERT IGNORE INTO api_client_scopes (client_id, scope_id) VALUES (?, ?)',
    [clientId, scopeId]
  );
}

async function removeScopeFromClient(executor, clientId, code) {
  const [result] = await executor.query(
    `DELETE cs FROM api_client_scopes cs
     JOIN api_scopes s ON s.id = cs.scope_id
     WHERE cs.client_id = ? AND s.code = ?`,
    [clientId, code]
  );
  return result;
}

async function recordClientAuditEvent(executor, clientId, eventType, details = null) {
  await executor.query(
    'INSERT INTO api_client_audit_events (client_id, event_type, details) VALUES (?, ?, ?)',
    [clientId, eventType, details ? JSON.stringify(details) : null]
  );
}

module.exports = {
  authenticateClient,
  getClientScopes,
  getActiveClientScopes,
  createAdminClient,
  createAdminClientSecret,
  listAdminClients,
  findAdminClientForUpdate,
  findActiveSecretsForUpdate,
  revokeActiveClientSecret,
  updateAdminClientStatus,
  revokeActiveClientSecrets,
  findScopeForUpdate,
  assignScopeToClient,
  removeScopeFromClient,
  recordClientAuditEvent,
};
