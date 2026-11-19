const crypto = require('crypto');

function digestSecret(secret) {
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

function secretMatches(secret, digest) {
  const expected = Buffer.isBuffer(digest) ? digest : Buffer.from(digest);
  const actual = digestSecret(secret);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function generateSecret() {
  return `acs_${crypto.randomBytes(32).toString('base64url')}`;
}

function parseBasicCredentials(header) {
  if (typeof header !== 'string' || !header.startsWith('Basic ')) return null;
  let decoded;
  try {
    decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  } catch (error) {
    return null;
  }
  const separator = decoded.indexOf(':');
  if (separator < 1) return null;
  const clientId = decoded.slice(0, separator);
  const clientSecret = decoded.slice(separator + 1);
  return clientSecret ? { clientId, clientSecret } : null;
}

function parseRequestedScopes(value) {
  if (value === undefined || value === '') return [];
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const scopes = normalized.split(/\s+/);
  return scopes.length === new Set(scopes).size ? scopes : null;
}

function parseApplicationToken(header) {
  if (typeof header !== 'string') return null;
  const token = header.trim();
  return token && !/\s/.test(token) ? token : null;
}

module.exports = { digestSecret, secretMatches, generateSecret, parseBasicCredentials, parseRequestedScopes, parseApplicationToken };
