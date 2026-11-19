function createAuthConfig(values) {
  const keys = new Map();
  const entries = values.keyRing.split(',').map((entry) => entry.trim()).filter(Boolean);

  for (const entry of entries) {
    const separator = entry.indexOf(':');
    const kid = entry.slice(0, separator);
    const encodedKey = entry.slice(separator + 1);
    if (separator < 1 || !/^[A-Za-z0-9._-]+$/.test(kid) || keys.has(kid)) {
      throw new Error('AUTH_JWT_KEY_RING contiene un kid no válido o duplicado');
    }
    if (!/^[A-Za-z0-9_-]+$/.test(encodedKey)) {
      throw new Error('AUTH_JWT_KEY_RING contiene una clave base64url no válida');
    }
    const key = Buffer.from(encodedKey, 'base64url');
    if (key.toString('base64url') !== encodedKey) {
      throw new Error('AUTH_JWT_KEY_RING contiene una clave base64url no canónica');
    }
    if (key.length < 32) throw new Error('Las claves de AUTH_JWT_KEY_RING deben tener al menos 256 bits');
    keys.set(kid, key);
  }

  if (!keys.has(values.activeKid)) throw new Error('AUTH_JWT_ACTIVE_KID no está presente en AUTH_JWT_KEY_RING');
  return { issuer: values.issuer, audience: values.audience, activeKid: values.activeKid, keys };
}

module.exports = { createAuthConfig };
