const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { digestSecret, secretMatches, parseBasicCredentials, parseRequestedScopes, parseApplicationToken } = require('../src/auth/credentials');
const { createAuthConfig } = require('../src/auth/config');
const { createJwtService } = require('../src/auth/jwt.service');
const { createTokenHandler } = require('../src/auth/oauth.controller');
const { createApplicationTokenMiddleware } = require('../src/auth/application.middleware');
const { createAdminService } = require('../src/auth/admin.service');
const validate = require('../src/middlewares/validate.middleware');
const errorMiddleware = require('../src/middlewares/error.middleware');
const { z } = require('zod');

function testJoseLoader() {
  const root = process.cwd();
  const candidates = [
    path.join(root, 'node_modules', 'jose', 'dist', 'webapi', 'index.js'),
    path.join(root, 'node_modules', 'node_modules', 'jose', 'dist', 'webapi', 'index.js'),
  ];
  const modulePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!modulePath) throw new Error('Install dependencies before running JWT tests');
  return import(`file://${modulePath}`);
}

function authConfig() {
  return createAuthConfig({
    issuer: 'https://issuer.example.test',
    audience: 'mum-api',
    activeKid: 'current',
    keyRing: `current:${Buffer.alloc(32, 1).toString('base64url')},old:${Buffer.alloc(32, 2).toString('base64url')}`,
  });
}

function response() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    set(name, value) { this.headers[name] = value; return this; },
  };
}

test('secrets are SHA-256 digests compared in constant time', () => {
  const digest = digestSecret('secret-value');
  assert.equal(digest.length, 32);
  assert.equal(secretMatches('secret-value', digest), true);
  assert.equal(secretMatches('other-value', digest), false);
});

test('Basic credentials parser accepts exactly a client id and non-empty secret', () => {
  const header = `Basic ${Buffer.from('client_id:secret:with:colon').toString('base64')}`;
  assert.deepEqual(parseBasicCredentials(header), { clientId: 'client_id', clientSecret: 'secret:with:colon' });
  assert.equal(parseBasicCredentials('Bearer token'), null);
  assert.equal(parseBasicCredentials(`Basic ${Buffer.from('client_id:').toString('base64')}`), null);
});

test('requested scopes reject duplicates and non-string values', () => {
  assert.deepEqual(parseRequestedScopes('catalog:read other:read'), ['catalog:read', 'other:read']);
  assert.deepEqual(parseRequestedScopes(undefined), []);
  assert.equal(parseRequestedScopes('   '), null);
  assert.equal(parseRequestedScopes('catalog:read catalog:read'), null);
  assert.equal(parseRequestedScopes(['catalog:read']), null);
});

test('key rings accept only canonical unpadded base64url keys', () => {
  const encoded = Buffer.alloc(32, 3).toString('base64url');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const finalIndex = alphabet.indexOf(encoded.at(-1));
  const noncanonical = `${encoded.slice(0, -1)}${alphabet[finalIndex + 1]}`;

  assert.equal(authConfig().keys.get('current').length, 32);
  assert.throws(() => createAuthConfig({ issuer: 'issuer', audience: 'audience', activeKid: 'key', keyRing: `key:${encoded}=` }));
  assert.throws(() => createAuthConfig({ issuer: 'issuer', audience: 'audience', activeKid: 'key', keyRing: `key:${encoded}!` }));
  assert.throws(() => createAuthConfig({ issuer: 'issuer', audience: 'audience', activeKid: 'key', keyRing: `key:${noncanonical}` }));
});

test('application token header contains only the JWT value', () => {
  assert.equal(parseApplicationToken('header.payload.signature'), 'header.payload.signature');
  assert.equal(parseApplicationToken('Bearer token'), null);
  assert.equal(parseApplicationToken(undefined), null);
});

test('JWTs are issued and verified with audience, expiry, and key validation', async () => {
  const config = authConfig();
  const service = createJwtService(config, testJoseLoader);
  const token = await service.issueToken({ clientId: 'client_test', scopes: ['catalog:read'] });
  const verified = await service.verifyToken(token);
  assert.equal(verified.protectedHeader.alg, 'HS256');
  assert.equal(verified.protectedHeader.kid, 'current');
  assert.equal(verified.payload.sub, 'client_test');
  assert.equal(verified.payload.scope, 'catalog:read');

  const wrongAudience = createJwtService({ ...config, audience: 'other-api' }, testJoseLoader);
  await assert.rejects(() => wrongAudience.verifyToken(token));

  const jose = await testJoseLoader();
  const expired = await new jose.SignJWT({ scope: 'catalog:read' })
    .setProtectedHeader({ alg: 'HS256', kid: 'current' })
    .setIssuer(config.issuer)
    .setSubject('client_test')
    .setAudience(config.audience)
    .setIssuedAt()
    .setExpirationTime('1 second ago')
    .sign(config.keys.get('current'));
  await assert.rejects(() => service.verifyToken(expired));

  const noExpiry = await new jose.SignJWT({ scope: 'catalog:read' })
    .setProtectedHeader({ alg: 'HS256', kid: 'current' })
    .setIssuer(config.issuer)
    .setSubject('client_test')
    .setAudience(config.audience)
    .setIssuedAt()
    .sign(config.keys.get('current'));
  await assert.rejects(() => service.verifyToken(noExpiry));

  const unknownKid = await new jose.SignJWT({ scope: 'catalog:read' })
    .setProtectedHeader({ alg: 'HS256', kid: 'unknown' })
    .setIssuer(config.issuer)
    .setSubject('client_test')
    .setAudience(config.audience)
    .setExpirationTime('15m')
    .sign(config.keys.get('current'));
  await assert.rejects(() => service.verifyToken(unknownKid));
});

test('OAuth invalid client responses retain the stable code and include a Spanish description', async () => {
  const handler = createTokenHandler({
    authConfig: authConfig(),
    clientRepository: { authenticateClient: async () => null, getClientScopes: async () => [] },
  });
  const res = response();
  await handler({ body: { grant_type: 'client_credentials' }, get: () => `Basic ${Buffer.from('unknown:bad').toString('base64')}` }, res, assert.fail);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, {
    error: 'invalid_client',
    error_description: 'Las credenciales de la aplicación no son válidas.',
  });
  assert.equal(res.headers['WWW-Authenticate'], 'Basic realm="oauth"');
});

test('OAuth missing body returns invalid_request', async () => {
  const handler = createTokenHandler({ authConfig: authConfig(), clientRepository: {} });
  const res = response();
  await handler({ get: () => undefined }, res, assert.fail);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    error: 'invalid_request',
    error_description: 'La solicitud OAuth no es válida.',
  });
});

test('application token middleware reads the dedicated header and mounts application data', async () => {
  const middleware = createApplicationTokenMiddleware({
    authConfig: authConfig(),
    jwtService: { verifyToken: async (token) => ({ payload: { sub: 'client_test', scope: 'catalog:read' } }) },
    clientRepository: { getActiveClientScopes: async () => ({ scopes: ['catalog:read'] }) },
  });
  const req = { get: (name) => (name === 'x-application-token' ? 'header.payload.signature' : undefined) };
  const res = response();
  let called = false;
  await middleware(req, res, () => { called = true; });
  assert.equal(called, true);
  assert.deepEqual(req.application, { clientId: 'client_test', scopes: ['catalog:read'] });

  const rejected = response();
  await middleware({ get: () => undefined }, rejected, assert.fail);
  assert.equal(rejected.statusCode, 401);
  assert.deepEqual(rejected.body, {
    error: 'invalid_application_token',
    message: 'El token de la aplicación no es válido.',
  });
});

test('validation middleware emits default Zod type errors in Spanish', () => {
  const middleware = validate(z.object({ edad: z.number() }));
  const res = response();
  middleware({ body: { edad: 'invalid' } }, res, assert.fail);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.details[0].message, 'Entrada inválida: se esperaba número, recibido texto');
});

test('error middleware hides internal messages in generic 500 responses', () => {
  const res = response();
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    errorMiddleware(new Error('database connection refused'), {}, res, assert.fail);
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { message: 'Error interno del servidor' });
});

function transactionDatabase(events) {
  const connection = {
    beginTransaction: async () => events.push('begin'),
    commit: async () => events.push('commit'),
    rollback: async () => events.push('rollback'),
    release: () => events.push('release'),
  };
  return { getConnection: async () => connection, connection };
}

test('admin client creation orchestrates repository work in one transaction', async () => {
  const events = [];
  const database = transactionDatabase(events);
  const repository = {
    createAdminClient: async (executor, publicId, name) => {
      assert.equal(executor, database.connection);
      assert.equal(publicId, 'client_test');
      assert.equal(name, 'Catalog reader');
      events.push('client');
      return { insertId: 42 };
    },
    createAdminClientSecret: async (executor, clientId, digest) => {
      assert.equal(executor, database.connection);
      assert.equal(clientId, 42);
      assert.equal(digest, 'digest:secret_test');
      events.push('secret');
    },
    findScopeForUpdate: async (executor, code) => {
      assert.equal(executor, database.connection);
      events.push(`scope:${code}`);
      return { id: 7, code };
    },
    assignScopeToClient: async (executor, clientId, scopeId) => {
      assert.equal(executor, database.connection);
      assert.equal(clientId, 42);
      assert.equal(scopeId, 7);
      events.push('assign');
    },
    recordClientAuditEvent: async (executor, clientId, eventType, details) => {
      assert.equal(executor, database.connection);
      assert.equal(clientId, 42);
      assert.equal(eventType, 'CLIENT_CREATED');
      assert.deepEqual(details, { scopes: ['catalog:read'] });
      events.push('audit');
    },
  };
  const service = createAdminService({
    database,
    repository,
    createPublicId: () => 'client_test',
    createSecret: () => 'secret_test',
    createSecretDigest: (secret) => `digest:${secret}`,
  });

  assert.deepEqual(await service.createClient('Catalog reader', ['catalog:read']), {
    publicId: 'client_test',
    secret: 'secret_test',
  });
  assert.deepEqual(events, ['begin', 'client', 'secret', 'scope:catalog:read', 'assign', 'audit', 'commit', 'release']);
});

test('admin client creation rolls back when repository persistence fails', async () => {
  const events = [];
  const database = transactionDatabase(events);
  const service = createAdminService({
    database,
    repository: {
      createAdminClient: async () => ({ insertId: 42 }),
      createAdminClientSecret: async () => { throw new Error('persistence failed'); },
    },
    createPublicId: () => 'client_test',
    createSecret: () => 'secret_test',
    createSecretDigest: () => 'digest',
  });

  await assert.rejects(() => service.createClient('Catalog reader', ['catalog:read']), /persistence failed/);
  assert.deepEqual(events, ['begin', 'rollback', 'release']);
});
