const { parseBasicCredentials, parseRequestedScopes } = require('./credentials');
const { createJwtService } = require('./jwt.service');

const oauthErrorDescriptions = {
  invalid_request: 'La solicitud OAuth no es válida.',
  unsupported_grant_type: 'El tipo de concesión no es compatible.',
  invalid_client: 'Las credenciales de la aplicación no son válidas.',
  invalid_scope: 'El ámbito solicitado no es válido o no está autorizado.',
  temporarily_unavailable: 'El servicio de autorización no está disponible temporalmente.',
};

function oauthError(res, status, error) {
  return res.status(status).json({ error, error_description: oauthErrorDescriptions[error] });
}

function createTokenHandler({ authConfig, clientRepository }) {
  const jwtService = createJwtService(authConfig);
  return async (req, res, next) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return oauthError(res, 400, 'invalid_request');
    }
    if (req.body.grant_type !== 'client_credentials') return oauthError(res, 400, 'unsupported_grant_type');
    const credentials = parseBasicCredentials(req.get('authorization'));
    if (!credentials) {
      res.set('WWW-Authenticate', 'Basic realm="oauth"');
      return oauthError(res, 401, 'invalid_client');
    }
    try {
      const client = await clientRepository.authenticateClient(credentials.clientId, credentials.clientSecret);
      if (!client) {
        res.set('WWW-Authenticate', 'Basic realm="oauth"');
        return oauthError(res, 401, 'invalid_client');
      }
      const requestedScopes = parseRequestedScopes(req.body.scope);
      if (!requestedScopes) return oauthError(res, 400, 'invalid_scope');
      const grantedScopes = await clientRepository.getClientScopes(client.id);
      const scopes = requestedScopes.length ? requestedScopes : grantedScopes;
      if (!scopes.length || scopes.some((scope) => !grantedScopes.includes(scope))) return oauthError(res, 400, 'invalid_scope');
      const accessToken = await jwtService.issueToken({ clientId: client.public_id, scopes });
      return res.json({ access_token: accessToken, token_type: 'Bearer', expires_in: 900, scope: scopes.join(' ') });
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = { createTokenHandler, oauthError };
