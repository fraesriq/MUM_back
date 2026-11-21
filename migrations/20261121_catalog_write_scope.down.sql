DELETE api_client_scopes
FROM api_client_scopes
INNER JOIN api_scopes ON api_scopes.id = api_client_scopes.scope_id
WHERE api_scopes.code = 'catalog:write';

DELETE FROM api_scopes WHERE code = 'catalog:write';
