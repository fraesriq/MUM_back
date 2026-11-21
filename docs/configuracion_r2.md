# Configuración de Cloudflare R2 privado

La API mantiene el bucket privado. Los clientes cargan y leen objetos mediante URLs firmadas temporales; la base de datos conserva únicamente la clave del objeto.

## Configuración rápida

1. En Cloudflare Dashboard, cree un bucket R2 privado.
2. Cree credenciales S3 con alcance **Object Read & Write** limitado a ese bucket.
3. Configure las variables en Render o en el entorno local. No incluya valores reales en el repositorio.
4. Mantenga los tiempos predeterminados: carga de 300 segundos y lectura de 3600 segundos.

| Variable | Propósito |
|---|---|
| `R2_ACCOUNT_ID` | Identificador de la cuenta Cloudflare. |
| `R2_ACCESS_KEY_ID` | Identificador de la credencial S3 limitada al bucket. |
| `R2_SECRET_ACCESS_KEY` | Secreto de la credencial S3 limitada al bucket. |
| `R2_BUCKET_NAME` | Nombre del bucket privado. |
| `R2_SIGNED_UPLOAD_TTL_SECONDS` | Duración de la URL PUT, entre `1` y `604800`; normalmente `300`. |
| `R2_SIGNED_DOWNLOAD_TTL_SECONDS` | Duración de la URL GET, entre `1` y `604800`; normalmente `3600`. |
| `R2_MAX_FILE_SIZE_BYTES` | Tamaño máximo admitido; normalmente `10485760`. |

## Flujo privado

1. Un cliente de gestión solicita `POST /api/v1/archivos/cargas` con `catalog:write`.
2. La API registra una autorización temporal ligada a la aplicación solicitante y entrega una URL PUT firmada con una clave administrada.
3. El cliente sube directamente a R2 con el encabezado `Content-Type` indicado. La URL también firma `content-length`: el navegador lo deriva del cuerpo `File`; no intente establecer manualmente ese encabezado restringido. El tamaño del archivo debe coincidir exactamente con `expected_size_bytes`.
4. La misma aplicación confirma con `POST /api/v1/archivos/cargas/confirmar`; la API consume la autorización, verifica tipo y tamaño con `HeadObject` antes de crear la fila. Una repetición segura devuelve el archivo ya confirmado sin duplicarlo.
5. Las respuestas públicas entregan URLs GET firmadas. No exponen la clave `ruta`.

Las URLs firmadas usan el endpoint S3 de R2 (`https://<cuenta>.r2.cloudflarestorage.com`), no un dominio personalizado.

## Migración antes del despliegue

La migración `20261121_archivo_r2_durability.up.sql` agrega unicidad de `archivo.ruta`, autorizaciones temporales de carga y tareas durables de limpieza. **Antes de aplicarla**, identifique y resuelva rutas duplicadas:

```sql
SELECT ruta, COUNT(*) FROM archivo GROUP BY ruta HAVING COUNT(*) > 1;
```

No aplique la migración si esta consulta devuelve filas. Las tareas de limpieza conservan la clave del objeto y el último error de forma interna para reintentos operativos.

## Recuperación de limpieza

`POST /api/v1/archivos/limpieza` requiere `catalog:write` y admite `{ "limit": 1..100 }`. Procesa únicamente tareas sin una fila actual de `archivo`; además, una `carga_pendiente` no vence ni se elimina mientras su autorización temporal siga vigente. Los fallos conservan e incrementan su evidencia para reintentos posteriores.

Antes de ejecutar el rollback de la migración, es obligatorio detenerse si alguna consulta devuelve filas:

```sql
SELECT COUNT(*) AS tareas_pendientes FROM r2_cleanup_tasks;
SELECT COUNT(*) AS cargas_sin_confirmar FROM r2_upload_grants WHERE confirmed_at IS NULL;
```

No ejecute el rollback hasta resolver ambas cantidades a cero. El rollback no debe usarse para borrar metadatos de recuperación.

> **Limitación actual:** la autenticación de usuarios finales todavía no existe. No exponga los endpoints de carga a usuarios públicos hasta implementar autenticación administrativa de usuarios.

## CORS del bucket

Configure esta regla en el bucket y reemplace los orígenes de ejemplo de Pages o del dominio personalizado:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "http://localhost:8788",
      "https://<proyecto>.pages.dev",
      "https://<dominio-personalizado>"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"]
  }
]
```

## Prueba manual sin secretos

1. En Postman, obtenga un token de una aplicación de gestión ya configurada; no pegue credenciales R2 en Postman ni en colecciones.
2. Solicite una carga con `x-application-token` y use la URL devuelta para un PUT con el mismo `Content-Type` y el cuerpo `File` cuyo tamaño sea `expected_size_bytes`; el navegador calcula `Content-Length`.
3. Confirme la carga con la clave, tamaño y metadatos.
4. Autorice y publique el archivo mediante la ruta de gestión si corresponde.
5. Consulte la galería, una especie o un lugar y abra la URL firmada antes de su vencimiento.

Verifique también los casos de tipo MIME incompatible, tamaño excedido y confirmación de una clave no administrada.
