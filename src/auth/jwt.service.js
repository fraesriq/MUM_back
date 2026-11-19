const crypto = require('crypto');

async function loadJose() {
  return import('jose');
}

function createJwtService(authConfig, joseLoader = loadJose) {
  async function issueToken({ clientId, scopes }) {
    const jose = await joseLoader();
    return new jose.SignJWT({ scope: scopes.join(' ') })
      .setProtectedHeader({ alg: 'HS256', kid: authConfig.activeKid })
      .setIssuer(authConfig.issuer)
      .setSubject(clientId)
      .setAudience(authConfig.audience)
      .setIssuedAt()
      .setExpirationTime('15m')
      .setJti(crypto.randomUUID())
      .sign(authConfig.keys.get(authConfig.activeKid));
  }

  async function verifyToken(token) {
    const jose = await joseLoader();
    const header = jose.decodeProtectedHeader(token);
    if (header.alg !== 'HS256' || typeof header.kid !== 'string' || !authConfig.keys.has(header.kid)) {
      throw new Error('Token de aplicación no válido');
    }
    return jose.jwtVerify(token, authConfig.keys.get(header.kid), {
      algorithms: ['HS256'],
      issuer: authConfig.issuer,
      audience: authConfig.audience,
      requiredClaims: ['exp'],
    });
  }

  return { issueToken, verifyToken };
}

module.exports = { createJwtService };
