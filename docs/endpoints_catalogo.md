# Catálogo de endpoints

Referencia breve de las rutas implementadas bajo `/api/v1`. Todas requieren una aplicación válida; los endpoints de gestión exigen además `catalog:write`. La ruta de token y los detalles del mecanismo de autenticación están en [AUTENTICACION.md](../AUTENTICACION.md). El flujo de objetos R2 está en [configuracion_r2.md](configuracion_r2.md).

## Convenciones

- Encabezado obligatorio: `X-Application-Token: <JWT>`. `catalog:write` incluye `catalog:read`.
- Para solicitudes con cuerpo, usar `Content-Type: application/json`. Los cuerpos indicados son **estrictos**: no se aceptan claves adicionales. En actualizaciones, al menos una propiedad es obligatoria.
- `{id}` y `{archivoId}` son enteros positivos. Los listados paginados responden `{ items, total, page, limit }`; `page` parte en `1` y `limit` en `20` (máximo `100`).
- `POST` de creación responde `201`; las demás operaciones exitosas responden `200`. Las eliminaciones exitosas responden `{ "deleted": true }`.

## Lectura pública

Estas rutas siguen requiriendo `catalog:read`; no requieren `catalog:write`.

| Recurso | Método y ruta | Consulta | Resultado |
|---|---|---|---|
| Categorías | `GET /categorias` | — | Todas las categorías. |
| Especies | `GET /especies` | `categoria` opcional: slug válido | Especies aprobadas. |
| Especie | `GET /especies/{slug}` | — | Ficha aprobada y archivos autorizados; `404` si no existe o no está aprobada. |
| Lugares | `GET /lugares` | — | Lugares aprobados. Las coordenadas no confirmadas se devuelven como `null`. |
| Lugar | `GET /lugares/{slug}` | — | Detalle aprobado y archivos autorizados; `404` si no existe o no está aprobado. |
| Galería | `GET /galeria` | `tipo` opcional (`foto`, `video`, `plano`, `logo`), `page`, `limit` | Archivos autorizados de galería, paginados. |
| Archivo de galería | `GET /galeria/{id}` | — | Archivo autorizado en galería; `404` si no es visible. |
| Contenidos | `GET /contenidos/aprobados` | `seccion` opcional, `page`, `limit` | Contenidos aprobados, paginados. |
| Fuentes | `GET /fuentes`, `GET /fuentes/{id}` | — | Fuentes; el detalle devuelve `404` si falta. |
| Geografía | `GET /regiones` | — | Regiones. |
| Provincias | `GET /regiones/{id}/provincias` | — | Provincias de una región; `404` si la región falta. |
| Comunas | `GET /provincias/{id}/comunas` | — | Comunas de una provincia; `404` si la provincia falta. |

Las URLs de lectura de archivos son firmadas y temporales; no se documentan ni persisten URLs firmadas en clientes.

## Gestión de especies y lugares

| Recurso | Método y ruta | Consulta o cuerpo |
|---|---|---|
| Especies | `GET /especies/gestion` | `page`, `limit`, `estado` (`pendiente`, `aprobado`, `rechazado`) y `categoria_id` opcionales. |
| Especie | `GET /especies/gestion/{id}` | — |
| Especie | `POST /especies` | Cuerpo de especie. |
| Especie | `PUT /especies/{id}` | Parcial de cuerpo de especie. |
| Especie | `PATCH /especies/{id}/aprobar` | `{ "estado": "aprobado" | "rechazado" }`. |
| Especie | `DELETE /especies/{id}` | — |
| Lugares | `GET /lugares/gestion` | `page`, `limit`, `estado` y `comuna_id` opcionales. |
| Lugar | `GET /lugares/gestion/{id}` | — |
| Lugar | `POST /lugares` | Cuerpo de lugar. |
| Lugar | `PUT /lugares/{id}` | Parcial de cuerpo de lugar. |
| Lugar | `PATCH /lugares/{id}/aprobar` | `{ "estado": "aprobado" | "rechazado" }`. |
| Lugar | `DELETE /lugares/{id}` | — |

Las altas de especies y lugares se crean en estado `pendiente`. La transición de aprobación solo admite `aprobado` o `rechazado`.

### Cuerpos estrictos

| Recurso | `POST` | `PUT` |
|---|---|---|
| Categoría | `nombre` (texto 2–80), `slug` (minúsculas y guiones, 2–90), `orden` (entero 0–65535) | Cualquier subconjunto de los mismos campos. |
| Especie | `id_categoria` (entero positivo), `slug` (2–180), `nombre_comun` (2–150), `descripcion` (1–10000); opcionales/anulables: `id_fuente`, `nombre_cientifico` (2–200) y `distribucion_geografica`, `habitat_ecosistema`, `alimentacion`, `habito`, `reproduccion` (1–10000 cada uno) | Mismos campos; `id_categoria` y `descripcion` pasan a ser opcionales. |
| Lugar | `id_comuna`, `slug` (2–180), `nombre` (2–150), `descripcion` (1–10000); opcionales: `id_coordenada`, `id_fuente` (anulables), `orden` (0–65535; predeterminado `1`) | Mismos campos, todos opcionales. |
| Fuente | `titulo` (1–255), `tipo` (`ficha`, `documento`, `institucion`, `web`, `otro`); opcionales: `autor_institucion` (hasta 200), `archivo_original` (hasta 500), `url` HTTP(S), `verificada` (booleano) | Cualquier subconjunto; los opcionales aceptan `null`. |
| Coordenada | `latitud` (-90 a 90), `longitud` (-180 a 180), ambas con hasta 7 decimales; opcionales: `url_mapa` HTTP(S) anulable, `confirmada` (booleano) | Cualquier subconjunto. |

Los campos de texto se recortan. Slugs de especie y lugar usan solo minúsculas, números y guiones. Los identificadores del cuerpo son números JSON, no cadenas.

### Asociaciones archivo–ficha

| Método y ruta | Cuerpo estricto | Efecto |
|---|---|---|
| `PUT /especies/{id}/archivos/{archivoId}` | `{ "es_portada_ficha": boolean, "orden_carrusel": entero 0–65535 }` | Crea o actualiza la asociación. |
| `DELETE /especies/{id}/archivos/{archivoId}` | — | Elimina la asociación. |
| `PUT /lugares/{id}/archivos/{archivoId}` | `{ "es_portada_lugar": boolean, "orden_carrusel": entero 0–65535 }` | Crea o actualiza la asociación. |
| `DELETE /lugares/{id}/archivos/{archivoId}` | — | Elimina la asociación. |

## Gestión de catálogos auxiliares

| Recurso | Rutas de gestión |
|---|---|
| Categorías | `GET /categorias/{id}`, `POST /categorias`, `PUT /categorias/{id}`, `DELETE /categorias/{id}`. |
| Fuentes | `POST /fuentes`, `PUT /fuentes/{id}`, `DELETE /fuentes/{id}`. |
| Coordenadas | `GET /coordenadas?page&limit`, `GET /coordenadas/{id}`, `POST /coordenadas`, `PUT /coordenadas/{id}`, `DELETE /coordenadas/{id}`. |
| Regiones | `GET /regiones/{id}`, `POST /regiones`, `PUT /regiones/{id}`, `DELETE /regiones/{id}`. Cuerpo: `{ "nombre": texto 2–100 }`; en `PUT`, `nombre` es opcional. |
| Provincias | `GET /provincias/{id}`, `POST /provincias`, `PUT /provincias/{id}`, `DELETE /provincias/{id}`. Cuerpo de alta: `{ "id_region": entero positivo, "nombre": texto 2–100 }`; ambos opcionales en `PUT`. |
| Comunas | `GET /comunas/{id}`, `POST /comunas`, `PUT /comunas/{id}`, `DELETE /comunas/{id}`. Cuerpo de alta: `{ "id_provincia": entero positivo, "nombre": texto 2–100 }`; ambos opcionales en `PUT`. |

## Contenidos y archivos

| Recurso | Rutas de gestión |
|---|---|
| Contenidos | `GET /contenidos?estado&seccion&page&limit`, `GET /contenidos/{id}`, `POST /contenidos`, `PUT /contenidos/{id}`, `PATCH /contenidos/{id}/aprobar`, `DELETE /contenidos/{id}`. `seccion`: `inicio`, `proyecto`, `historia`, `visitantes`, `creditos`, `aplicacion`; los estados y la transición usan `pendiente`, `aprobado`, `rechazado`. |
| Archivos | `GET /archivos?tipo&page&limit`, `GET /archivos/{id}`, `PUT /archivos/{id}`, `DELETE /archivos/{id}`. |
| R2: solicitar carga | `POST /archivos/cargas` con `{ "tipo", "content_type", "tamanio_bytes" }`; devuelve una autorización de carga temporal. |
| R2: confirmar carga | `POST /archivos/cargas/confirmar` con `object_key`, `content_type`, `tamanio_bytes` y metadatos estrictos de archivo. |
| R2: limpieza | `POST /archivos/limpieza` con `{ "limit": 1..100 }` opcional; procesa tareas pendientes. |

Los archivos admiten tipos `foto`, `video`, `plano` y `logo`. La confirmación exige `tipo`, `titulo` y `credito`; `permiso` (predeterminado `pendiente`) y `en_galeria_general` (predeterminado `false`) son opcionales. `id_fuente`, `texto_alt` y `orden_galeria` son opcionales/anulables. `texto_alt` es obligatorio para todo tipo distinto de `video`. Consulte el ciclo completo, MIME permitidos y encabezados firmados en [configuracion_r2.md](configuracion_r2.md).

## Errores y conflictos

- `400`: parámetros, consulta o cuerpo no cumplen la validación estricta.
- `401`: falta o no es válido `X-Application-Token`; `403`: falta el alcance requerido o la carga pertenece a otra aplicación.
- `404`: no existe el recurso solicitado, la asociación, o un recurso público no es visible.
- `409`: duplicados; referencias inexistentes en altas o actualizaciones; eliminación de recursos con dependencias; y estados incompatibles o expirados del ciclo de carga R2.
- `503`: una operación R2 completó el cambio de referencia pero no pudo registrar o cerrar de forma segura su tarea de limpieza.

## Exclusiones deliberadas

- La CLI de administración de clientes de aplicación no forma parte de la API de catálogo; consulte [AUTENTICACION.md](../AUTENTICACION.md).
- No existe autenticación ni autorización de usuarios finales. `Authorization` queda reservado para esa capacidad futura.
