-- DETENER: no ejecute este rollback si cualquiera de estas consultas devuelve filas.
-- SELECT COUNT(*) AS tareas_pendientes FROM r2_cleanup_tasks;
-- SELECT COUNT(*) AS cargas_sin_confirmar FROM r2_upload_grants WHERE confirmed_at IS NULL;
-- Eliminar estas tablas con recuperación pendiente destruiría evidencia operativa.
DROP TABLE r2_upload_grants;
DROP TABLE r2_cleanup_tasks;
ALTER TABLE archivo
  DROP INDEX uq_archivo_ruta,
  MODIFY COLUMN ruta VARCHAR(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;
