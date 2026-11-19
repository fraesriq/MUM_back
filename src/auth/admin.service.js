const crypto = require('crypto');
const { digestSecret, generateSecret } = require('./credentials');

function clientPublicId() {
  return `client_${crypto.randomUUID()}`;
}

function createAdminService({
  database,
  repository,
  createPublicId = clientPublicId,
  createSecret = generateSecret,
  createSecretDigest = digestSecret,
} = {}) {
  const activeDatabase = database || require('../config/database');
  const activeRepository = repository || require('./client.repository');

  async function withTransaction(action) {
    const connection = await activeDatabase.getConnection();
    try {
      await connection.beginTransaction();
      const result = await action(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function lockedClient(connection, publicId) {
    const client = await activeRepository.findAdminClientForUpdate(connection, publicId);
    if (!client) throw new Error('Cliente no encontrado');
    return client;
  }

  async function grantScopeById(connection, clientId, code) {
    const scope = await activeRepository.findScopeForUpdate(connection, code);
    if (!scope) throw new Error(`Ámbito desconocido: ${code}`);
    await activeRepository.assignScopeToClient(connection, clientId, scope.id);
  }

  async function createClient(name, scopes) {
    if (!name || !scopes.length) throw new Error('Se requiere un nombre de cliente y al menos un ámbito');
    return withTransaction(async (connection) => {
      const publicId = createPublicId();
      const insert = await activeRepository.createAdminClient(connection, publicId, name);
      const secret = createSecret();
      await activeRepository.createAdminClientSecret(connection, insert.insertId, createSecretDigest(secret));
      for (const scope of scopes) await grantScopeById(connection, insert.insertId, scope);
      await activeRepository.recordClientAuditEvent(connection, insert.insertId, 'CLIENT_CREATED', { scopes });
      return { publicId, secret };
    });
  }

  async function listClients() {
    return activeRepository.listAdminClients();
  }

  async function rotateSecret(publicId) {
    return withTransaction(async (connection) => {
      const client = await lockedClient(connection, publicId);
      if (client.status !== 'ACTIVE') throw new Error('Solo los clientes activos pueden rotar secretos');
      const secrets = await activeRepository.findActiveSecretsForUpdate(connection, client.id);
      if (secrets.length >= 2) throw new Error('Un cliente no puede tener más de dos secretos activos');
      const secret = createSecret();
      await activeRepository.createAdminClientSecret(connection, client.id, createSecretDigest(secret));
      await activeRepository.recordClientAuditEvent(connection, client.id, 'SECRET_ROTATED');
      return { publicId: client.public_id, secret };
    });
  }

  async function revokeSecret(publicId, secretId) {
    return withTransaction(async (connection) => {
      const client = await lockedClient(connection, publicId);
      const result = await activeRepository.revokeActiveClientSecret(connection, secretId, client.id);
      if (!result.affectedRows) throw new Error('Secreto activo no encontrado');
      await activeRepository.recordClientAuditEvent(connection, client.id, 'SECRET_REVOKED', { secretId: Number(secretId) });
    });
  }

  async function changeClientStatus(publicId, status) {
    return withTransaction(async (connection) => {
      const client = await lockedClient(connection, publicId);
      if (client.status === 'REVOKED' && status !== 'REVOKED') throw new Error('Un cliente revocado no puede reactivarse');
      if (client.status === status) return;
      await activeRepository.updateAdminClientStatus(connection, client.id, status);
      if (status === 'REVOKED') await activeRepository.revokeActiveClientSecrets(connection, client.id);
      await activeRepository.recordClientAuditEvent(connection, client.id, `CLIENT_${status}`);
    });
  }

  async function grantScope(publicId, code) {
    return withTransaction(async (connection) => {
      const client = await lockedClient(connection, publicId);
      await grantScopeById(connection, client.id, code);
      await activeRepository.recordClientAuditEvent(connection, client.id, 'SCOPE_GRANTED', { scope: code });
    });
  }

  async function revokeScope(publicId, code) {
    return withTransaction(async (connection) => {
      const client = await lockedClient(connection, publicId);
      const result = await activeRepository.removeScopeFromClient(connection, client.id, code);
      if (!result.affectedRows) throw new Error('Ámbito asignado no encontrado');
      await activeRepository.recordClientAuditEvent(connection, client.id, 'SCOPE_REVOKED', { scope: code });
    });
  }

  return { createClient, listClients, rotateSecret, revokeSecret, changeClientStatus, grantScope, revokeScope };
}

let defaultAdminService;

function getDefaultAdminService() {
  if (!defaultAdminService) defaultAdminService = createAdminService();
  return defaultAdminService;
}

module.exports = {
  createClient: (...args) => getDefaultAdminService().createClient(...args),
  listClients: (...args) => getDefaultAdminService().listClients(...args),
  rotateSecret: (...args) => getDefaultAdminService().rotateSecret(...args),
  revokeSecret: (...args) => getDefaultAdminService().revokeSecret(...args),
  changeClientStatus: (...args) => getDefaultAdminService().changeClientStatus(...args),
  grantScope: (...args) => getDefaultAdminService().grantScope(...args),
  revokeScope: (...args) => getDefaultAdminService().revokeScope(...args),
  createAdminService,
};
