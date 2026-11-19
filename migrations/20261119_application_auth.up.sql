CREATE TABLE api_clients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  status ENUM('ACTIVE', 'SUSPENDED', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_api_clients_public_id (public_id),
  KEY idx_api_clients_status (status)
) ENGINE=InnoDB;

CREATE TABLE api_client_secrets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id BIGINT UNSIGNED NOT NULL,
  secret_digest BINARY(32) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_api_client_secrets_active (client_id, revoked_at),
  CONSTRAINT fk_api_client_secrets_client FOREIGN KEY (client_id) REFERENCES api_clients (id)
) ENGINE=InnoDB;

CREATE TABLE api_scopes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(96) NOT NULL,
  description VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_api_scopes_code (code)
) ENGINE=InnoDB;

CREATE TABLE api_client_scopes (
  client_id BIGINT UNSIGNED NOT NULL,
  scope_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, scope_id),
  KEY idx_api_client_scopes_scope (scope_id),
  CONSTRAINT fk_api_client_scopes_client FOREIGN KEY (client_id) REFERENCES api_clients (id),
  CONSTRAINT fk_api_client_scopes_scope FOREIGN KEY (scope_id) REFERENCES api_scopes (id)
) ENGINE=InnoDB;

CREATE TABLE api_client_audit_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  details JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_api_client_audit_events_client_created (client_id, created_at),
  CONSTRAINT fk_api_client_audit_events_client FOREIGN KEY (client_id) REFERENCES api_clients (id)
) ENGINE=InnoDB;

INSERT INTO api_scopes (code, description)
VALUES ('catalog:read', 'Consultar el catálogo público')
ON DUPLICATE KEY UPDATE description = VALUES(description);
