# Integrar una aplicación con el catálogo MUM

**Empiece en su servidor, no en el navegador.** Solicite a operaciones el origen HTTPS del ambiente, un identificador de aplicación y un secreto con `catalog:read`. Para una web o una aplicación móvil, use un backend intermediario: este guarda las credenciales, autoriza a sus usuarios y devuelve únicamente los datos que necesitan. MUM autentica aplicaciones, no personas. No distribuya una credencial de gestión a los dispositivos.

El [contrato OpenAPI](openapi.yaml) describe las operaciones; la [matriz de trazabilidad](API_CONTRACT_TRACEABILITY.md) conecta cada una con su implementación. Son **69 operaciones registradas**: dos de salud y una de token en la raíz, más 66 bajo `/api/v1`. El PUT directo al almacenamiento no es una ruta adicional de MUM.

## Primera lectura con cURL

Ejemplo para una terminal privada con Bash, cURL y jq. `MUM_ORIGIN` es el origen HTTPS aprobado, sin barra final ni `/api/v1`; `MUM_CLIENT_ID` es el identificador provisionado. Desactive el trazado de shell. cURL solicita el secreto sin incluirlo en la línea de comandos. No use salida detallada ni guarde la respuesta de token en archivos o registros.

```bash
set -o pipefail
TOKEN=$(curl --silent --show-error --fail --proto '=https' \
  --user "$MUM_CLIENT_ID" \
  --data 'grant_type=client_credentials' --data 'scope=catalog:read' \
  "$MUM_ORIGIN/oauth/token" | jq -er '.access_token') && \
printf 'X-Application-Token: %s\n' "$TOKEN" | \
  curl --silent --show-error --fail --proto '=https' --header @- \
    "$MUM_ORIGIN/api/v1/categorias"
unset TOKEN
```

1. **Emitir:** `POST /oauth/token` recibe Basic y `grant_type=client_credentials`; el ejemplo usa formulario. El éxito es `200` con `access_token`, `token_type: "Bearer"`, `expires_in: 900` (segundos) y `scope` (texto separado por espacios). Pida un alcance explícito: si se omite, el servidor intenta emitir todos los asignados.
2. **Consumir:** a pesar de `token_type`, v1 espera el JWT **solo**, en `X-Application-Token`, no en `Authorization: Bearer`. Categorías devuelve una lista JSON, no un objeto `data`. Un catálogo vacío puede devolver `[]`.
3. **Renovar:** reutilice el token en memoria hasta poco antes de su vencimiento. No hay ruta de refresh registrada: solicite otro con Basic. El servidor comprueba la aplicación y sus permisos vigentes en cada acceso; los 900 segundos no garantizan acceso hasta el último segundo.

## Elegir la ruta y el permiso

En la tabla se omite `/api/v1`. «Lectura» significa `catalog:read`, **no** acceso anónimo. `catalog:write` satisface también lectura, no al revés. Use un cliente separado para publicar.

| Necesidad | Lectura | Gestión (`catalog:write`) |
|---|---|---|
| Clasificar y citar | `GET /categorias`, `GET /fuentes`, `GET /fuentes/{id}` | Alta, edición y baja de ambos recursos; `GET /categorias/{id}` también exige escritura. |
| Mostrar fichas | `GET /especies` (opcional `categoria` por slug), `GET /lugares`; detalle por `/{slug}` en ambas colecciones | `GET /gestion` y `/gestion/{id}` **dentro de cada colección**; `POST` a la colección, `PUT` o `DELETE` por ID, `PATCH /{id}/aprobar`, `PUT` o `DELETE /{id}/archivos/{archivoId}`. |
| Navegar el territorio | `GET /regiones`, `/regiones/{id}/provincias`, `/provincias/{id}/comunas` | Alta, detalle por ID, edición y baja de regiones, provincias y comunas; toda `/coordenadas`, incluso sus GET. |
| Mostrar una sección | `GET /contenidos/aprobados?seccion=inicio` | `GET` y `POST /contenidos`, `GET`, `PUT` y `DELETE /contenidos/{id}`, `PATCH /contenidos/{id}/aprobar`. |
| Mostrar o gestionar medios | `GET /galeria` y `/galeria/{id}` | Toda `/archivos`: listado, detalle, edición, baja, autorización de carga, confirmación y limpieza. No se carga con `POST /galeria`. |

En las fichas públicas se consulta por **slug** y solo se muestran registros aprobados; no derive el identificador de gestión a partir del slug. Evite `gestion` como slug. En un lugar sin coordenadas confirmadas, `latitud`, `longitud` y `url_mapa` son `null`: no dibuje un punto en `(0,0)`. Galería filtra por permiso autorizado **y** presencia en la galería general. Use `url` antes de `url_expires_in` (segundos); vuelva a consultar para obtener otra URL. No conserve ni registre enlaces firmados.

## Caso editorial: del borrador a la vista de inicio

Ejemplo JavaScript de servidor (Node con `fetch`). `origen` es configuración HTTPS de confianza, no una URL aportada por el usuario. `token` es un token vigente obtenido con `catalog:write`. Las rutas del ejemplo son constantes o se construyen con el ID devuelto; nunca reenvíe el encabezado a otro origen.

```js
async function publicarEjemplo(origen, token) {
  async function api(ruta, method = 'GET', datos) {
    const r = await fetch(`${origen}/api/v1${ruta}`, {
      method, redirect: 'error',
      headers: { 'X-Application-Token': token,
        ...(datos ? { 'Content-Type': 'application/json' } : {}) },
      body: datos ? JSON.stringify(datos) : undefined,
    });
    if (!r.ok) throw new Error(`MUM: HTTP ${r.status}`);
    return r.json();
  }
  const borrador = await api('/contenidos', 'POST', {
    seccion: 'inicio', titulo: 'Recorrido de muestra',
    texto: 'Material editorial ficticio.', orden: 1,
  });
  const id = borrador.id_contenido;
  // En un flujo real, publicar solo tras la revisión editorial.
  await api(`/contenidos/${id}/aprobar`, 'PATCH', { estado: 'aprobado' });
  return api('/contenidos/aprobados?seccion=inicio&page=1&limit=20');
}
```

El alta devuelve la fila (`201`), con `estado: "pendiente"` si se omitió. La aprobación devuelve la fila actualizada (`200`); la consulta devuelve `{ items, total, page, limit }`, no necesariamente el contenido nuevo en la primera página. Se ordena por `orden` y luego por ID. Para paginar, empiece en `page=1`; `limit` vale 20 por defecto y admite hasta 100. No agregue paginación a colecciones que devuelven listas simples.

En escrituras use JSON con las claves del esquema, IDs numéricos positivos, booleanos reales y ningún campo adicional. Un `PUT` no siempre acepta cualquier subconjunto: por ejemplo, en especies siguen siendo obligatorios `slug` y `nombre_comun`. En aprobación use `aprobado` o `rechazado`, no `pendiente`.

## Caso de medios: una foto no queda publicada al subir sus bytes

| Paso | Acción y resultado esperado |
|---|---|
| 1. Autorizar (API, escritura) | `POST /api/v1/archivos/cargas`. Para una imagen PNG sintética de exactamente 2048 bytes: `{"tipo":"foto","content_type":"image/png","tamanio_bytes":2048}`. Sustituya el tamaño por el real. `201` entrega `object_key`, `upload_url`, `expires_in`, `required_headers`, `signed_headers` y `expected_size_bytes`. |
| 2. Transferir (almacenamiento) | Haga `PUT` a **esa** `upload_url` antes de que venza. Envíe los bytes sin multipart, con `Content-Type` devuelto y la longitud exacta firmada. Para un `File` del navegador, deje que el navegador calcule `Content-Length`. No envíe Basic ni `X-Application-Token`. Solo continúe si el PUT tuvo éxito. |
| 3. Confirmar (API, misma aplicación) | `POST /api/v1/archivos/cargas/confirmar`. Reutilice los tres campos del paso 1 y el `object_key` exacto del paso 1; agregue `titulo: "Figura de muestra"`, `credito: "Equipo de muestra"`, `texto_alt: "Un círculo azul"`. La API contrasta MIME y longitud del objeto antes del alta. `201` devuelve la fila con `id_archivo`; repetir la confirmación consistente devuelve el archivo ya creado, no una actualización de metadatos. |
| 4. Dar visibilidad (gestión editorial) | Por defecto `permiso` es `pendiente` y `en_galeria_general` es `false`. Tras autorizar el uso del material, `PUT /api/v1/archivos/{id}` con `{"permiso":"autorizado","en_galeria_general":true}` permite su lectura por `/galeria/{id}`. Para una ficha, gestione la asociación en la colección correspondiente. |
| 5. Retirar | `DELETE /api/v1/archivos/{id}` elimina la referencia y procura borrar el objeto. Si falla, compruebe primero si la referencia aún existe. `POST /api/v1/archivos/limpieza` es una acción operativa, no el siguiente paso de cada carga: recibe, por ejemplo, `{"limit":20}` y responde con contadores `processed`, `deleted`, `failed`. |

Fotos y logos admiten JPEG, PNG, WebP y AVIF; videos, MP4 y WebM; planos, PDF, JPEG, PNG y WebP. `texto_alt` es obligatorio salvo para video. El tamaño máximo y las vigencias de firma dependen del ambiente; una URL de carga no es una URL de lectura. Antes de integrar en navegador, confirme con operaciones la política CORS del almacenamiento, independiente de la API.

## Interpretar el estado antes del cuerpo

| HTTP y forma del cuerpo | Decisión del consumidor |
|---|---|
| `200` / `201`: lista, página, fila u objeto de operación | No espere una envoltura universal. Un borrado exitoso devuelve `{"deleted":true}`, no `204`. |
| OAuth `400`, `401`, `429`: `{error,error_description}` si responde el controlador o el limitador | Corrija concesión o alcance; para `invalid_client` revise el aprovisionamiento. Ante `429`, espere antes de volver a emitir; el limitador de token está configurado en 20 solicitudes por minuto. |
| Analizador de cuerpos, incluido OAuth: `400`, `413`, `415` con `{message}` | Un JSON mal formado puede fallar **antes** de OAuth o de la validación de campos. Para `413`, reduzca el cuerpo; para `415`, compruebe juego de caracteres y codificación. No envíe los bytes del archivo como JSON a la API. |
| v1 `401` / `403`: `{error,message}` en las guardias | Ante `401`, revise vigencia y aplicación; renueve una vez para una lectura, no en bucle. `403 insufficient_scope` requiere otro permiso, no otro intento con el mismo alcance. Un `403` de confirmación puede llevar solo `message`. |
| `400`: `{error,details:[{path,message}]}` o `{message}` | Muestre el campo rechazado si hay `details`. Revise tipo, campos extra y límites; no dependa de textos exactos. |
| `404` / `409`: normalmente `{message}` para recursos | Distinga ficha no visible de error de conexión. Ante un conflicto, relea el recurso y sus dependencias antes de decidir si repetir. |
| `500`: `{message}` | No presuponga que una escritura se revirtió. Consulte su estado, especialmente en archivos. No repita automáticamente altas ni bajas. |
| Salud (sin token) | `GET /health/live` devuelve `200 {"status":"live"}`; `GET /health` devuelve `200 {"status":"ok","database":"ready"}` o `503 {"status":"degraded","database":"unavailable"}`. Ninguna comprueba R2. |

**Antes de entregar:** confirme origen, scopes, tamaño permitido y responsable de incidencias por un canal aprobado. No se verificaron ambientes, IDs existentes, CORS efectivo ni transferencias reales. Los ejemplos se cotejaron con código, no son transcripciones de tráfico. Véanse el [catálogo de rutas](endpoints_catalogo.md), la [autenticación](../AUTENTICACION.md), el [flujo privado R2](configuracion_r2.md) y las [brechas conocidas](API_CONTRACT_GAP_ANALYSIS.md).
