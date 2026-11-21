-- DETENER antes de aplicar si esta consulta devuelve filas: SELECT ruta FROM archivo WHERE ruta REGEXP '[^[:ascii:]]';
-- Las rutas existentes no ASCII o multibyte no pueden convertirse sin revisión a la semántica ASCII/binaria de las claves R2.
-- Antes de aplicar, comprobar rutas duplicadas: SELECT ruta, COUNT(*) FROM archivo GROUP BY ruta HAVING COUNT(*) > 1;
ALTER TABLE archivo
  MODIFY COLUMN ruta VARCHAR(1024) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  ADD UNIQUE KEY uq_archivo_ruta (ruta);

CREATE TABLE r2_cleanup_tasks (
  object_key VARCHAR(1024) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  reason VARCHAR(128) NOT NULL,
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  last_error VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (object_key)
) ENGINE=InnoDB;

CREATE TABLE r2_upload_grants (
  object_key VARCHAR(1024) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  application_public_id VARCHAR(64) NOT NULL,
  tipo ENUM('foto', 'video', 'plano', 'logo') NOT NULL,
  content_type VARCHAR(128) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  confirmed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (object_key),
  KEY idx_r2_upload_grants_expiry (expires_at)
) ENGINE=InnoDB;
