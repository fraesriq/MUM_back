const { parseApplicationToken } = require('./credentials');
const { createJwtService } = require('./jwt.service');

const applicationErrorMessages = {
  invalid_application_token: 'El token de la aplicación no es válido.',
  insufficient_scope: 'El token de la aplicación no tiene los permisos necesarios.',
};

function createApplicationTokenMiddleware({ authConfig, clientRepository, jwtService }) {
  const tokenService = jwtService || createJwtService(authConfig);
  return async (req, res, next) => {
    const token = parseApplicationToken(req.get('x-application-token'));
    if (!token) return res.status(401).json({ error: 'invalid_application_token', message: applicationErrorMessages.invalid_application_token });
    try {
      const { payload } = await tokenService.verifyToken(token);
      if (typeof payload.sub !== 'string' || typeof payload.scope !== 'string') throw new Error('Token de aplicación no válido');
      const authorization = await clientRepository.getActiveClientScopes(payload.sub);
      if (!authorization) throw new Error('Cliente de aplicación inactivo');
      const tokenScopes = payload.scope.split(' ').filter(Boolean);
      if (!tokenScopes.length || tokenScopes.some((scope) => !authorization.scopes.includes(scope))) throw new Error('Ámbito de aplicación no vigente');
      req.application = { clientId: payload.sub, scopes: tokenScopes };
      return next();
    } catch (error) {
      return res.status(401).json({ error: 'invalid_application_token', message: applicationErrorMessages.invalid_application_token });
    }
  };
}

function requireScope(scope) {
  return (req, res, next) => (req.application && req.application.scopes.includes(scope)
    ? next()
    : res.status(403).json({ error: 'insufficient_scope', message: applicationErrorMessages.insufficient_scope }));
}

module.exports = { createApplicationTokenMiddleware, requireScope };
