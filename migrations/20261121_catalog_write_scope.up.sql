INSERT INTO api_scopes (code, description)
VALUES ('catalog:write', 'Gestionar el catálogo')
ON DUPLICATE KEY UPDATE description = VALUES(description);
