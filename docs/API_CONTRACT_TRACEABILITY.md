# Matriz de trazabilidad de la API de MUM

**69 operaciones explícitas: 66 bajo `/api/v1`, dos de salud y una de autenticación.** Cada fila se identifica por método y ruta completa. El inventario procede de los registros de Express, no de ejemplos de consumo ni de la especificación OpenAPI. La cobertura del inventario no equivale a cobertura de pruebas.

## Cómo verificar una fila

1. **Reconstruir la ruta.** [server.js](../src/server.js) carga la [aplicación](../src/routes/app.js#L34-L48). Allí se registran salud y token y se monta `/api/v1`. El [router de versión](../src/routes/index.js#L14-L22) añade el prefijo de cada módulo, excepto geografía, montado en `/`. El enlace «rutas» de cada sección aporta el último segmento y el orden de los manejadores.
2. **Seguir la petición.** Todas las filas pasan por Helmet, CORS y los analizadores JSON y de formulario. **L** añade `createApplicationTokenMiddleware` (JWT en `X-Application-Token`, `verifyToken`, cliente activo y permisos vigentes mediante `getActiveClientScopes`) y `requireScope('catalog:read')`. **E** añade a L `requireScope('catalog:write')`. Escritura satisface lectura, no al revés. Véanse el [middleware de aplicación](../src/auth/application.middleware.js) y el [middleware de errores](../src/middlewares/error.middleware.js). «Público» en el catálogo designa una proyección, no acceso anónimo.
3. **Identificar entrada y salida.** `p:`, `q:` y `b:` indican `params`, `query` y `body` en [validate](../src/middlewares/validate.middleware.js). Se omite el sufijo `Schema`: `p:idParam` significa `validate(idParamSchema, 'params')`. «—» indica que la ruta no monta `validate`. **C/S** nombra el símbolo tanto del controlador como del servicio; **R** identifica las llamadas principales al repositorio, no cada lectura interna posterior a una escritura. Los enlaces de cada sección resuelven esos símbolos y las proyecciones, incluso cuando no existe una clase DTO. `[]` es una lista; `página(X)` contiene `items`, `total`, `page`, `limit`; `borrado` es `{"deleted":true}`.
4. **Interpretar las pruebas.** `H` identifica una petición HTTP en la prueba citada (puede probar solo rechazo o usar dependencias sustituidas); `I`, evidencia indirecta de controlador, servicio, repositorio o esquema sin petición a esa operación. `Sin caso` indica que no se identificó una prueba específica. Los números son líneas de los archivos enlazados: **T** es la prueba local de la sección; **Cat** es [catalog.test.js](../test/catalog.test.js) y **Lect** es [catalog-read.test.js](../test/catalog-read.test.js). Son referencias estáticas, no resultados de ejecución.

## Salud y autenticación · 3

[Rutas y límites](../src/routes/app.js#L17-L46) · [controlador OAuth](../src/auth/oauth.controller.js) · [validación de credenciales y ámbitos](../src/auth/credentials.js) · [servicio JWT](../src/auth/jwt.service.js) · [repositorio de clientes](../src/auth/client.repository.js) · [T: autenticación](../test/auth.test.js)

| Método y ruta | Acceso y validación | Implementación | Salida | Prueba |
|---|---|---|---|---|
| `GET /health/live` | Sin token; — | Manejador en línea; sin servicio ni repositorio | `status: live` | Sin caso |
| `GET /health` | Sin token; — | Manejador en línea → `pool.query('SELECT 1')`; sin repositorio | `status/database`: `ok/ready` o 503 `degraded/unavailable` | Sin caso |
| `POST /oauth/token` | `oauthLimiter` (20/min); cuerpo objeto, `grant_type=client_credentials`, Basic, ámbitos concedidos | `createTokenHandler` → `parseBasicCredentials`, `authenticateClient`, `parseRequestedScopes`, `getClientScopes`, `issueToken` | `access_token, token_type, expires_in, scope`; error OAuth: `error, error_description` | I T:129–154 (controlador: cliente inválido y cuerpo ausente), T:86 (JWT) |

## Categorías · 5

[Rutas](../src/modules/categorias/categorias.routes.js) · [validación](../src/modules/categorias/categorias.validation.js) · [C](../src/modules/categorias/categorias.controller.js) · [S](../src/modules/categorias/categorias.service.js) · [R](../src/modules/categorias/categorias.repository.js) · [T](../test/categorias-management.test.js). Categoría corresponde a `columns`: `id_categoria, nombre, slug, orden`.

| Método y ruta | Acceso; validación | C/S → R | Salida | Prueba |
|---|---|---|---|---|
| `GET /api/v1/categorias` | L; — | getAll → findAll | Categoría[] | H T:51 |
| `GET /api/v1/categorias/{id}` | E; p:idParam | getById → findById | Categoría | H T:52 (403) |
| `POST /api/v1/categorias` | E; b:createCategoria | create → create | Categoría | H T:53–56 |
| `PUT /api/v1/categorias/{id}` | E; p:idParam, b:updateCategoria | update → findById, update | Categoría | I T:61,70 (esquema y repositorio) |
| `DELETE /api/v1/categorias/{id}` | E; p:idParam | remove → remove | borrado | H T:57 |

## Especies · 10

[Rutas](../src/modules/especies/especies.routes.js) · [validación](../src/modules/especies/especies.validation.js) · [C](../src/modules/especies/especies.controller.js) · [S](../src/modules/especies/especies.service.js) · [R](../src/modules/especies/especies.repository.js) · [T](../test/especies-management.test.js).

En especies y lugares, `/gestion` precede al detalle por slug. OpenAPI representa el segmento compartido mediante `{identificador}`: **GET recibe el slug sin esquema de parámetro; PUT y DELETE reciben el id validado**, no el slug. En las asociaciones, `padres` significa `findManagementById(id)` y [`archivos.findById(archivoId)`](../src/modules/archivos/archivos.repository.js); `mapPublicFiles` pertenece al [servicio de archivos](../src/modules/archivos/archivos.service.js). «Gestión» conserva la proyección administrativa del repositorio.

| Método y ruta | Acceso; validación | C/S → R | Salida | Prueba |
|---|---|---|---|---|
| `GET /api/v1/especies/gestion` | E; q:managementQuery | getManagementAll → findManagementAll | página(especie de gestión) | H T:39–41 |
| `GET /api/v1/especies/gestion/{id}` | E; p:idParam | getManagementById → findManagementById | especie de gestión | I T:108 (servicio) |
| `POST /api/v1/especies` | E; b:createEspecie | create → create | especie de gestión pendiente | H T:43–45 |
| `PUT /api/v1/especies/{id}/archivos/{archivoId}` | E; p:associationParam, b:archivoAssociation | associateArchivo → padres, upsertArchivoAssociation | ids, `es_portada_ficha`, `orden_carrusel` | H T:137–140; I T:148 |
| `DELETE /api/v1/especies/{id}/archivos/{archivoId}` | E; p:associationParam | removeArchivoAssociation → padres, removeArchivoAssociation | borrado | H T:141 |
| `PUT /api/v1/especies/{identificador}` | E; p:idParam, b:updateEspecie | update → findManagementById, update | especie de gestión | I T:92,108 |
| `PATCH /api/v1/especies/{id}/aprobar` | E; p:idParam, b:approvalEspecie | approve → findManagementById, setEstado | especie de gestión con nuevo estado | H T:46–49 |
| `DELETE /api/v1/especies/{identificador}` | E; p:idParam | remove → remove | borrado | H T:50 |
| `GET /api/v1/especies` | L; q:publicListQuery | getAll → findAll | proyección pública SQL[] | H T:68–75 (categoría) |
| `GET /api/v1/especies/{identificador}` | L; — | getBySlug → findBySlug, mapPublicFiles | ficha pública con archivos firmados | H T:42; I Cat:419,457 |

## Lugares · 10

[Rutas](../src/modules/lugares/lugares.routes.js) · [validación](../src/modules/lugares/lugares.validation.js) · [C](../src/modules/lugares/lugares.controller.js) · [S](../src/modules/lugares/lugares.service.js) · [R](../src/modules/lugares/lugares.repository.js) · [T](../test/lugares-management.test.js). `toPublicLugar` elimina campos internos y oculta las coordenadas no confirmadas; no se usa en las lecturas de gestión.

| Método y ruta | Acceso; validación | C/S → R | Salida | Prueba |
|---|---|---|---|---|
| `GET /api/v1/lugares/gestion` | E; q:managementQuery | getManagementAll → findManagementAll | página(lugar de gestión) | H T:39–41 |
| `GET /api/v1/lugares/gestion/{id}` | E; p:idParam | getManagementById → findManagementById | lugar de gestión | H T:42–43,49 |
| `POST /api/v1/lugares` | E; b:createLugar | create → create | lugar de gestión pendiente | H T:45–47 |
| `PUT /api/v1/lugares/{id}/archivos/{archivoId}` | E; p:associationParam, b:archivoAssociation | associateArchivo → padres, upsertArchivoAssociation | ids, `es_portada_lugar`, `orden_carrusel` | H T:119–122; I T:129 |
| `DELETE /api/v1/lugares/{id}/archivos/{archivoId}` | E; p:associationParam | removeArchivoAssociation → padres, removeArchivoAssociation | borrado | H T:123 |
| `PUT /api/v1/lugares/{identificador}` | E; p:idParam, b:updateLugar | update → findManagementById, update | lugar de gestión | H T:48 (400) |
| `PATCH /api/v1/lugares/{id}/aprobar` | E; p:idParam, b:approvalLugar | approve → findManagementById, setEstado | lugar de gestión con nuevo estado | H T:50–53 |
| `DELETE /api/v1/lugares/{identificador}` | E; p:idParam | remove → remove | borrado | H T:54–55 |
| `GET /api/v1/lugares` | L; — | getAll → findAll | `toPublicLugar`[] | I Cat:429,457 (consulta y DTO) |
| `GET /api/v1/lugares/{identificador}` | L; — | getBySlug → findBySlug, mapPublicFiles | ficha pública con archivos firmados | H T:44; I Cat:419 |

## Galería · 2

[Rutas](../src/modules/galeria/galeria.routes.js) · [validación](../src/modules/galeria/galeria.validation.js) · [C](../src/modules/galeria/galeria.controller.js) · [S](../src/modules/galeria/galeria.service.js). No hay repositorio propio: [archivos S](../src/modules/archivos/archivos.service.js) proyecta con `mapPublicArchivo` y `withoutPrivateFields` a partir de [archivos R](../src/modules/archivos/archivos.repository.js). La respuesta sustituye la ruta privada por `url` y `url_expires_in`.

| Método y ruta | Acceso; validación | C/S → archivos S → archivos R | Salida | Prueba |
|---|---|---|---|---|
| `GET /api/v1/galeria` | L; q:listQuery | getAll → getPublicGallery → findPublicGallery | página(archivo público) | H Cat:277,301; I Cat:251 |
| `GET /api/v1/galeria/{id}` | L; p:idParam | getById → getPublicGalleryById → findPublicGalleryById | archivo público | H Cat:539 (400); I Cat:259 |

## Contenidos · 7

[Rutas](../src/modules/contenidos/contenidos.routes.js) · [validación](../src/modules/contenidos/contenidos.validation.js) · [C](../src/modules/contenidos/contenidos.controller.js) · [S](../src/modules/contenidos/contenidos.service.js) · [R](../src/modules/contenidos/contenidos.repository.js). Contenido es la proyección `contenidoColumns` del repositorio, también en el listado de aprobados.

| Método y ruta | Acceso; validación | C/S → R | Salida | Prueba |
|---|---|---|---|---|
| `GET /api/v1/contenidos/aprobados` | L; q:listQuery | getAprobados → findAllAprobados | página(contenido), estado fijado en SQL | H Cat:328 (consulta) |
| `GET /api/v1/contenidos` | E; q:listQuery | getAll → findAll | página(contenido) | H Cat:328 (consulta) |
| `GET /api/v1/contenidos/{id}` | E; p:idParam | getById → findById | contenido | H Cat:539 (400) |
| `POST /api/v1/contenidos` | E; b:createContenido | create → create | contenido | I Cat:468 (estado predeterminado del esquema) |
| `PUT /api/v1/contenidos/{id}` | E; p:idParam, b:updateContenido | update → findById, update | contenido | I Cat:468 (esquema) |
| `PATCH /api/v1/contenidos/{id}/aprobar` | E; p:idParam, b:aprobar | aprobar → findById, update | contenido con nuevo estado | Sin caso de aprobación; I Cat:531 (id compartido) |
| `DELETE /api/v1/contenidos/{id}` | E; p:idParam | remove → remove | borrado | Sin caso de borrado; I Cat:531 (id compartido) |

## Archivos · 7

[Rutas](../src/modules/archivos/archivos.routes.js) · [validación](../src/modules/archivos/archivos.validation.js) · [C](../src/modules/archivos/archivos.controller.js) · [S](../src/modules/archivos/archivos.service.js) · [R](../src/modules/archivos/archivos.repository.js) · [servicio R2](../src/storage/r2.service.js). E se aplica con `router.use` incluso a GET. En ambas operaciones de carga, C toma el identificador del cliente de `req.application`. Para las tareas de limpieza, `cerrar/anotar` designa `completeCleanupTask` y `recordCleanupTask`, según el resultado.

| Método y ruta | Acceso; validación | C/S → R y almacenamiento | Salida | Prueba |
|---|---|---|---|---|
| `POST /api/v1/archivos/cargas` | E; b:upload; tamaño y compatibilidad tipo/MIME | requestUpload → createUploadGrant, createPresignedUpload | clave, URL de carga, vigencia, cabeceras y tamaño esperado | H Cat:390 (403); I Cat:79–106 |
| `POST /api/v1/archivos/cargas/confirmar` | E; b:confirmUpload; clave, cliente, autorización y metadatos del objeto | confirmUpload → findUploadGrant, findByRuta, headObject, insertWithGrantConfirmation; compensación: deleteObject, cerrar/anotar | archivo de gestión creado o ya confirmado | I Cat:131–178 |
| `POST /api/v1/archivos/limpieza` | E; b:cleanup | processCleanup → listPendingCleanupTasks, deleteObject, cerrar/anotar | `processed, deleted, failed` | I Cat:199–232 |
| `GET /api/v1/archivos` | E; q:listQuery | getAll → findAll | página(archivo de gestión) | H Cat:328,401 |
| `GET /api/v1/archivos/{id}` | E; p:idParam | getById → findById | archivo de gestión | H Cat:539 (400) |
| `PUT /api/v1/archivos/{id}` | E; p:idParam, b:updateArchivo; S valida la fila combinada con `createArchivoSchema` | update → findById, update | archivo de gestión | I Cat:474,521 |
| `DELETE /api/v1/archivos/{id}` | E; p:idParam | remove → deleteWithCleanup, deleteObject, cerrar/anotar | borrado | I Cat:179–198 |

## Fuentes · 5

[Rutas](../src/modules/fuentes/fuentes.routes.js) · [validación](../src/modules/fuentes/fuentes.validation.js) · [C](../src/modules/fuentes/fuentes.controller.js) · [S](../src/modules/fuentes/fuentes.service.js) · [R](../src/modules/fuentes/fuentes.repository.js) · [T](../test/fuentes-management.test.js). Fuente es `toPublicFuente`: selecciona `id_fuente, titulo, tipo, autor_institucion, url, verificada` y convierte `verificada` en booleano.

| Método y ruta | Acceso; validación | C/S → R | Salida | Prueba |
|---|---|---|---|---|
| `GET /api/v1/fuentes` | L; — | getAll → findAll | fuente[] | H T:37; I Lect:38,53 |
| `GET /api/v1/fuentes/{id}` | L; p:idParam | getById → findById | fuente | H Lect:127,168 (id y permiso) |
| `POST /api/v1/fuentes` | E; b:createFuente | create → create | fuente | H T:38–41 |
| `PUT /api/v1/fuentes/{id}` | E; p:idParam, b:updateFuente | update → findById, update | fuente | H T:42 (400) |
| `DELETE /api/v1/fuentes/{id}` | E; p:idParam | remove → remove | borrado | H T:43 |

## Coordenadas · 5

[Rutas](../src/modules/coordenadas/coordenadas.routes.js) · [validación](../src/modules/coordenadas/coordenadas.validation.js) · [C](../src/modules/coordenadas/coordenadas.controller.js) · [S](../src/modules/coordenadas/coordenadas.service.js) · [R](../src/modules/coordenadas/coordenadas.repository.js) · [T](../test/coordenadas-management.test.js). E se aplica al router completo. Coordenada es `toCoordenadaDto`, no la fila sin transformar.

| Método y ruta | Acceso; validación | C/S → R | Salida | Prueba |
|---|---|---|---|---|
| `GET /api/v1/coordenadas` | E; q:paginationQuery | getAll → findAll | página(coordenada) | H T:37–39 |
| `GET /api/v1/coordenadas/{id}` | E; p:idParam | getById → findById | coordenada | H T:37 (403); I T:69 |
| `POST /api/v1/coordenadas` | E; b:createCoordenada | create → create | coordenada | H T:37,40–41 |
| `PUT /api/v1/coordenadas/{id}` | E; p:idParam, b:updateCoordenada | update → findById, update | coordenada | H T:37,42 (403/400) |
| `DELETE /api/v1/coordenadas/{id}` | E; p:idParam | remove → remove | borrado | H T:37,43 |

## Geografía · 15

[Rutas](../src/modules/geografia/geografia.routes.js) · [validación](../src/modules/geografia/geografia.validation.js) · [C](../src/modules/geografia/geografia.controller.js) · [S](../src/modules/geografia/geografia.service.js) · [R](../src/modules/geografia/geografia.repository.js) · [T](../test/geografia-management.test.js). Los DTO son proyecciones SQL: cada entidad tiene id propio y `nombre`; provincia añade `id_region` y comuna `id_provincia`. En colecciones anidadas, padre inexistente produce 404, no una lista vacía.

| Método y ruta | Acceso; validación | C/S → R | Salida | Prueba |
|---|---|---|---|---|
| `GET /api/v1/regiones` | L; — | getRegiones → findRegiones | región[] | H T:38 |
| `GET /api/v1/regiones/{id}/provincias` | L; p:idParam | getProvinciasByRegionId → findRegionById, findProvinciasByRegionId | provincia[] | H T:48; H Lect:103,127 |
| `GET /api/v1/regiones/{id}` | E; p:idParam | getRegionById → findRegionById | región | H T:39 (403); I T:85 |
| `POST /api/v1/regiones` | E; b:region | createRegion → createRegion | región | H T:40–41 |
| `PUT /api/v1/regiones/{id}` | E; p:idParam, b:updateRegion | updateRegion → findRegionById, updateRegion | región | I T:63,73,89 |
| `DELETE /api/v1/regiones/{id}` | E; p:idParam | removeRegion → removeRegion | borrado | I T:73,102 |
| `GET /api/v1/provincias/{id}/comunas` | L; p:idParam | getComunasByProvinciaId → findProvinciaById, findComunasByProvinciaId | comuna[] | H T:49; H Lect:103,127 |
| `GET /api/v1/provincias/{id}` | E; p:idParam | getProvinciaById → findProvinciaById | provincia | I Lect:61 (consulta del padre, no detalle HTTP) |
| `POST /api/v1/provincias` | E; b:provincia | createProvincia → findRegionById, createProvincia | provincia | H T:42; I T:86 |
| `PUT /api/v1/provincias/{id}` | E; p:idParam, b:updateProvincia | updateProvincia → findProvinciaById, findRegionById si cambia el padre, updateProvincia | provincia | H T:51 (400); I T:90,94 |
| `DELETE /api/v1/provincias/{id}` | E; p:idParam | removeProvincia → removeProvincia | borrado | I T:74,85 |
| `GET /api/v1/comunas/{id}` | E; p:idParam | getComunaById → findComunaById | comuna | H T:43,45 |
| `POST /api/v1/comunas` | E; b:comuna | createComuna → findProvinciaById, createComuna | comuna | H T:44; I T:87 |
| `PUT /api/v1/comunas/{id}` | E; p:idParam, b:updateComuna | updateComuna → findComunaById, findProvinciaById si cambia el padre, updateComuna | comuna | H T:46,52 |
| `DELETE /api/v1/comunas/{id}` | E; p:idParam | removeComuna → removeComuna | borrado | H T:47; I T:103 |

## Límites de la evidencia

- `HEAD` derivado de `GET` y `OPTIONS` implícito de Express/CORS no tienen registros de operación propios. Las URLs firmadas apuntan a R2: la transferencia se realiza fuera del router de MUM. La [CLI de clientes](../bin/api-client.js) tampoco es una operación HTTP.
- Los esquemas citados validan entradas, no todas las salidas. Cuando el controlador serializa una fila SQL directamente, la evidencia del DTO es la consulta enlazada; no se infieren tipos de ejecución adicionales a partir de datos simulados.
- El contraste es estático: no acredita la configuración de un despliegue, disponibilidad de la base de datos, transferencia real en R2 ni éxito de un recorrido completo con credenciales reales.
