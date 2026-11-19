# Autenticación de aplicaciones

Este servicio autentica ante la API únicamente a intermediarios de servidor confiables. Los navegadores y las aplicaciones móviles nunca deben recibir un secreto de cliente ni una clave de firma. La autenticación de usuarios finales se encuentra expresamente fuera de este alcance.

## Puesta en marcha

1. Aplicar `migrations/20261119_application_auth.up.sql` después del esquema existente de la base de datos.
2. Configurar las variables de entorno requeridas e iniciar el servicio.
3. Crear un cliente para el intermediario mediante `npm run client -- create "intermediario de catálogo" catalog:read` y almacenar el secreto mostrado en el gestor de secretos del intermediario.

## Configuración

| Variable de entorno | Propósito |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Configuración de la conexión con MySQL. |
| `AUTH_JWT_ISSUER` | Valor exacto del emisor de los JWT. |
| `AUTH_JWT_AUDIENCE` | Valor exacto de la audiencia de los JWT. |
| `AUTH_JWT_ACTIVE_KID` | `kid` utilizado para firmar los JWT nuevos. |
| `AUTH_JWT_KEY_RING` | Entradas `kid:clave-codificada-en-base64url` separadas por comas. Cada clave decodificada debe contener al menos 32 bytes. La clave anterior debe conservarse durante la superposición de tokens y eliminarse después de 15 minutos. |

El servicio no se inicia en producción cuando falta una variable de autenticación requerida o el conjunto de claves es inválido. No se deben incorporar valores reales al control de versiones.

## Administración de clientes

Los secretos se generan con 256 bits aleatorios, se muestran únicamente mediante `create` y `rotate`, y se almacenan solo como resúmenes SHA-256. Cada cliente puede tener como máximo dos secretos activos.

```sh
npm run client -- create "intermediario de catálogo" catalog:read
npm run client -- list
npm run client -- rotate <client-id>
npm run client -- revoke-secret <client-id> <secret-id>
npm run client -- suspend <client-id>
npm run client -- activate <client-id>
npm run client -- revoke <client-id>
npm run client -- grant-scope <client-id> catalog:read
npm run client -- revoke-scope <client-id> catalog:read
```

Los cambios de clientes, secretos, estados y permisos se registran en `api_client_audit_events` dentro de la misma transacción que modifica el estado.

## Contrato de tokens y de la API

El token de 15 minutos se solicita a `POST /oauth/token` mediante credenciales HTTP Basic y un cuerpo `application/x-www-form-urlencoded`:

```sh
curl -u "$CLIENT_ID:$CLIENT_SECRET" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data 'grant_type=client_credentials&scope=catalog:read' \
  http://localhost:3000/oauth/token
```

Solo se admite `client_credentials` y no se emiten tokens de actualización. Las credenciales de cliente inválidas siempre producen la respuesta OAuth neutral `invalid_client`. Los tokens utilizan HS256 con un `kid` explícito e incluyen los atributos `iss`, `sub` (el identificador público del cliente), `aud`, `iat`, `exp`, `jti` y `scope`; los permisos se separan mediante espacios.

Las rutas del catálogo se consumen con el encabezado dedicado, no con `Authorization`:

```text
X-Application-Token: <JWT>
```

`Authorization` queda disponible para la futura identidad de usuarios finales. Todas las rutas `/api/v1` requieren un cliente válido y activo, además de una asignación vigente de permisos. Las rutas GET actuales del catálogo requieren `catalog:read`. `/oauth/token`, `/health` y `/health/live` no requieren un token de aplicación. `/health/live` comprueba únicamente que el proceso esté activo; `/health` informa la disponibilidad de la base de datos sin revelar detalles de sus errores.

## Verificación local

```sh
npm test
npm ls --depth=0
```

El limitador de OAuth permite 20 solicitudes por IP cada minuto y mantiene su estado en memoria. La protección se aplica por proceso; antes de depender de ella en un despliegue con múltiples instancias se debe configurar un almacenamiento compartido para limitar las solicitudes.

## Reversión

Se debe impedir que los clientes soliciten tokens nuevos, esperar al menos 15 minutos para que expiren los tokens emitidos y aplicar `migrations/20261119_application_auth.down.sql`. La reversión elimina las identidades de aplicaciones cliente, las credenciales, las asignaciones de permisos y el historial de auditoría creados por este hito.
