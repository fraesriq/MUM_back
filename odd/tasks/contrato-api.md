# Contrato AS-IS de MUM
Rama `develop`, árbol de trabajo sobre `a8b57d9`. Entrega local sin commits (`ask-on-risk` solo si se autorizara publicar). Estimación: más de 400 líneas de documentación. Pruebas: inventario, referencias, validación OpenAPI y ejemplos con herramientas locales.

## Specs
S1. «El contrato debe representar fielmente el comportamiento actual de la API (AS-IS), basándose en evidencia obtenida directamente del repositorio.» «Incluye todas las operaciones que formen parte de la interfaz expuesta a sus consumidores.»

S2. «Contrato formal de la API utilizando OpenAPI 3.1.» «Utiliza componentes reutilizables y referencias `$ref` para garantizar la consistencia y mantenibilidad de la especificación.»

S3. «Guía de integración orientada a desarrolladores consumidores de la API.» «Debe incluir procedimientos de autenticación, ejemplos de consumo mediante cURL y JavaScript/TypeScript, flujos funcionales, manejo de errores y consideraciones de seguridad.»

S4. «Clasifica los hallazgos por criticidad y distingue claramente el comportamiento actual (AS-IS) de las propuestas de mejora (TO-BE).»

S5. «Matriz de trazabilidad que relacione cada operación documentada con las evidencias de su implementación, incluyendo archivos, funciones, validaciones, middlewares y pruebas relevantes.»

S6. «Las brechas e incertidumbres estén documentadas.» «No se hayan introducido modificaciones funcionales en la aplicación.»

## Tasks
T1 (S1,S2,S5) Delegado en paralelo: cuatro módulos documentales de catálogo, 66 operaciones; entregado; sin commit.
T2 (S1,S2) Integración inline: salud, token, respuestas comunes y documento raíz; entregado; sin commit.
T3 (S3,S4,S6) Delegado en paralelo: guía y análisis; entregado y corregida la distinción entre errores del parser y OAuth; sin commit.
T4 (S1,S5,S6) Delegado en paralelo: matriz de 69 operaciones cotejada independientemente con los routers; entregada; sin commit.
T5 (S1–S6) Verificación independiente: riesgo 2, credenciales y permisos; verificaciones locales completadas, validación integral con herramienta OAS especializada pendiente por disponibilidad; sin commit.

## Log
L1. Solicitud original:

# Generación del contrato formal de la API

## Objetivo

Generar el contrato formal de la API existente en el repositorio actual, utilizando OpenAPI 3.1 como estándar de especificación, de manera que cualquier consumidor web, móvil o sistema externo pueda integrarse de forma autónoma, segura y predecible, sin necesidad de conocer la implementación interna del backend.

## Metodología de trabajo

Utiliza el flujo de trabajo ODD configurado en Gentle-IA.

Respeta las instrucciones del repositorio, las decisiones arquitectónicas existentes y las convenciones del proyecto.

Delega el análisis, la ejecución y la verificación a los agentes y skills correspondientes, utilizando los mecanismos nativos de orquestación de Gentle-IA.

## Contexto y alcance

El contrato debe representar fielmente el comportamiento actual de la API (AS-IS), basándose en evidencia obtenida directamente del repositorio.

Considera las rutas, controladores, servicios, middlewares, modelos, DTO, esquemas de validación, mecanismos de seguridad, configuraciones y pruebas existentes.

Incluye todas las operaciones que formen parte de la interfaz expuesta a sus consumidores.

## Requisitos del contrato

Documenta, cuando corresponda:

- Propósito y alcance de la API.
- URL base, ambientes y versionamiento.
- Autenticación y autorización.
- Roles y permisos.
- Endpoints y métodos HTTP.
- Identificadores únicos de operación (`operationId`).
- Parámetros de ruta y consulta.
- Encabezados requeridos.
- Esquemas de solicitud y respuesta.
- Tipos de datos, formatos y restricciones.
- Campos obligatorios, opcionales y anulables.
- Valores permitidos y valores por defecto.
- Códigos de estado HTTP.
- Estructuras y códigos de error.
- Ejemplos válidos de solicitudes y respuestas.
- Paginación, filtros y ordenamiento.
- Reglas de negocio relevantes para los consumidores.
- Límites de consumo e idempotencia, cuando estén implementados.

Utiliza componentes reutilizables y referencias `$ref` para garantizar la consistencia y mantenibilidad de la especificación.

## Entregables

Genera los siguientes artefactos, respetando la estructura documental existente del repositorio. Si no existe una convención establecida, utiliza `docs/api/`.

### 1. `openapi.yaml`

Contrato formal de la API utilizando OpenAPI 3.1.

Debe ser procesable por herramientas de documentación, validación, pruebas de contrato y generación de clientes tipados.

### 2. `API_INTEGRATION_GUIDE.md`

Guía de integración orientada a desarrolladores consumidores de la API.

Debe incluir procedimientos de autenticación, ejemplos de consumo mediante cURL y JavaScript/TypeScript, flujos funcionales, manejo de errores y consideraciones de seguridad.

### 3. `API_CONTRACT_GAP_ANALYSIS.md`

Informe de brechas que identifique:

- Inconsistencias en la interfaz.
- Comportamientos ambiguos.
- Validaciones ausentes.
- Riesgos de seguridad.
- Diferencias entre implementación, documentación y pruebas.
- Información que no pueda determinarse.
- Mejoras recomendadas.

Clasifica los hallazgos por criticidad y distingue claramente el comportamiento actual (AS-IS) de las propuestas de mejora (TO-BE).

### 4. `API_CONTRACT_TRACEABILITY.md`

Matriz de trazabilidad que relacione cada operación documentada con las evidencias de su implementación, incluyendo archivos, funciones, validaciones, middlewares y pruebas relevantes.

## Restricciones

- No inventes endpoints, campos, respuestas ni comportamientos.
- No introduzcas supuestos sin evidencia.
- No modifiques el código fuente de la aplicación.
- No alteres las reglas de negocio existentes.
- No instales dependencias ni modifiques configuraciones sin autorización.
- No expongas credenciales, tokens, secretos ni información sensible.
- No realices commits ni push.
- No sobrescribas documentación existente sin analizar su contenido y preservar la información relevante.
- Registra explícitamente cualquier incertidumbre o contradicción.
- Mantén las propuestas de mejora separadas del contrato actual.

## Criterios de aceptación

El resultado se considerará satisfactorio cuando:

- La especificación OpenAPI sea sintáctica y semánticamente válida.
- El 100 % de las operaciones identificadas dentro del alcance estén documentadas o tengan una exclusión debidamente justificada.
- Todas las referencias `$ref` sean resolubles.
- Los esquemas correspondan a las estructuras y validaciones reales de la API.
- Los mecanismos de autenticación y autorización estén correctamente representados.
- Los ejemplos sean coherentes con los esquemas definidos.
- Cada operación sea trazable a evidencia del repositorio.
- Un desarrollador externo pueda consumir la API sin acceder al código fuente del backend.
- Las brechas e incertidumbres estén documentadas.
- No se hayan introducido modificaciones funcionales en la aplicación.

## Evidencias de cumplimiento

Al finalizar, presenta un informe que incluya:

- Artefactos generados y sus ubicaciones.
- Cantidad de operaciones identificadas.
- Cantidad de operaciones documentadas.
- Porcentaje de cobertura contractual.
- Validaciones ejecutadas y sus resultados.
- Evidencias de cumplimiento de los criterios de aceptación.
- Hallazgos relevantes y su criticidad.
- Bloqueos, incertidumbres y decisiones pendientes.
- Recomendaciones para mantener el contrato sincronizado con la implementación.

No te limites a generar un plan o una propuesta. Ejecuta el trabajo utilizando el flujo ODD de Gentle-IA y entrega los artefactos correspondientes dentro del repositorio.

El resultado debe quedar preparado para su revisión y aprobación como fuente de verdad contractual de la API.

L2. Cinco archivos ya modificados al inicio. El inventario detectó 69 operaciones explícitas. Se conserva la documentación existente en `docs/`. Documentación pasiva: no corresponde RED de comportamiento; se contrasta el resultado con los routers y esquemas.

L3. La comparación independiente dio igualdad de conjuntos router/contrato/matriz: 69 operaciones en 40 rutas, 69 operationId únicos, 46 parámetros de ruta obligatorios; 2 anónimas, 1 Basic, 13 de lectura y 53 de escritura. Se comprobaron 70 destinos enlazados por la matriz. El alcance excluye HEAD/OPTIONS implícitos, CLI y transferencia directa a R2.

L4. La verificación local de JSON Schema Draft 2020-12 comprobó 69 ejemplos y 17 valores por defecto sin discrepancias. Se probó el flujo editorial con validadores reales y transporte simulado; la sintaxis del ejemplo cURL se comprobó con `bash -n`. No se ejecutó la suite de la aplicación ni se usaron servicios, secretos o datos reales.

L5. Se corrigió el contrato y la guía tras verificar errores del parser previos al enrutamiento. Revalidación: 697/697 referencias resolubles, 28/28 operaciones con cuerpo incluyen 413 y 415; OAuth 400 admite ambas envolturas. No se localizó un validador OAS 3.1 dedicado. Antes de aprobación formal, ejecutar `openapi-spec-validator docs/openapi.yaml` en un entorno autorizado con esa herramienta y probar la generación con el cliente elegido. Los chequeos parciales no certifican por sí solos la conformidad integral. No se autorizó instalar dependencias, publicar ni hacer commits.
