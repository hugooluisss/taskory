## Context

El estándar MCP de autorización se apoya en OAuth 2.1: el cliente MCP recibe un 401 con `WWW-Authenticate` apuntando a los metadatos del recurso, descubre el servidor de autorización, se registra dinámicamente, abre el navegador y obtiene tokens con PKCE. Taskory ya tiene usuarios y login (fase 01).

## Goals / Non-Goals

**Goals:** conexión del agente sin copiar claves; revocable; sin dependencias externas.
**Non-goals:** OIDC, login social, scopes finos.

## Decisions

- **La API es el servidor de autorización** (un solo despliegue, misma base de datos). Sin Keycloak ni otro servicio.
- **Rutas**: `/.well-known/*` y `/oauth/*` van fuera del prefijo `/api/v1` (los clientes las esperan en raíz); el proxy del despliegue las enruta a la API. `/api/v1/connected-apps` sí lleva prefijo.
- **Consentimiento en la web**: `GET /oauth/authorize` valida cliente, `redirect_uri` y PKCE, y redirige a `/oauth/consent?request=<id>` de la web. La web (con el JWT del usuario) llama a `POST /api/v1/oauth/requests/:id/decision {approve}` y recibe la URL de redirección final. Así se reutiliza el login existente y no hay una segunda pantalla de login.
- **Tokens opacos** con prefijo (`to_` access, `tr_` refresh), guardados con SHA-256. El guard de la fase 01 gana un tercer tipo de credencial; los services no cambian.
- **Reuso de código o refresh** revoca toda la autorización (detección de robo).
- **Redirect URIs**: coincidencia exacta; solo `https`, loopback `http` o esquemas propios sin comodines.
- **Las API keys se conservan** como opción avanzada; la UI las presenta en segundo plano.
- **`PUBLIC_URL`** define el `issuer`; sin ella la API no arranca en producción.

## Arquitectura controller -> service -> repository

- `OAuthMetadataController`, `OAuthController` (`register`, `authorize`, `token`, `revoke`), `ConnectedAppsController`: solo entrada/salida y códigos OAuth (`invalid_grant`, etc.).
- `OAuthService` (reglas: PKCE, caducidades, rotación, detección de reuso), `ClientRegistrationService` (validación de redirect URIs), `ConnectedAppsService`.
- `OAuthClientsRepository`, `AuthorizationsRepository`, `OAuthTokensRepository`: único acceso a datos.
- El guard consulta `OAuthService.resolveAccessToken`, no los repositories.

## Risks / Trade-offs

- Registro dinámico abierto permite crear clientes basura → rate limit y limpieza de clientes sin autorizaciones.
- Clientes MCP con soporte OAuth desigual → mantener API keys como alternativa.
- Phishing de consentimiento → mostrar nombre del cliente y su dominio de redirección en la pantalla.

## Open Questions

Ninguna bloqueante. Verificar con el cliente real del usuario (Claude Code) en la tarea de revisión.

## Decisiones tras la revisión de seguridad (ronda 2)

- **Un solo recurso protegido**: el servicio Taskory completo, identificado como `<PUBLIC_URL>/mcp` (el mismo que anuncian los metadatos). La API es parte del mismo despliegue y la misma frontera de confianza que el MCP, así que el MCP reenvía el token del usuario a la API; esto es una desviación consciente de la regla estricta de "no pasar tokens a otros servicios" de la especificación MCP, que está pensada para APIs de terceros. La mitigación es que los tokens quedan ligados por audiencia a este único recurso (`invalid_target` para cualquier otro) y que la API los acepta solo con esa audiencia.
- **Alcance**: un único alcance `taskory` de acceso completo; los demás se rechazan (`invalid_scope`). Sin alcances finos (fuera de objetivo).
- **Reuso de código**: revoca la autorización completa (no solo los tokens con `codeId`), porque las rotaciones no heredan el `codeId`.
- **Evidencia de reuso**: los códigos usados y los refresh rotados se conservan mientras la autorización siga viva; se purgan solo autorizaciones muertas (revocadas o sin ningún token sin caducar) con antigüedad mínima, junto con sus clientes sin autorizaciones y sin solicitudes de consentimiento pendientes.
- **Aprobación atómica**: reclamar la solicitud, crear la autorización y guardar el código en una transacción del repository.
- **iss (RFC 9207)** en todas las respuestas redirigibles; **PUBLIC_URL** validada como emisor `https` en producción; registro honesto de `token_endpoint_auth_method`.
- **Consentimiento en la web (fase 06)**: la página debe impedir ser enmarcada (`frame-ancestors 'none'`), mostrar el `client_id` y el destino completo, y marcar los nombres dinámicos como no verificados.
- **Consecuencia operativa del reuso**: repetir un código o un refresh rotado revoca toda la autorización, también cuando el cliente legítimo reintenta tras perder una respuesta o dos refrescos coinciden; es un compromiso aceptado de seguridad. Los clientes deben serializar sus refrescos y reautorizar tras ese caso.
- **Una sola conexión SQLite**: TypeORM con `better-sqlite3` reutiliza un único query runner, y las transacciones anidadas usan savepoints; dos transacciones solapadas se pisarían. Todas las transacciones de escritura múltiple pasan por un ejecutor serializado (una cola de promesas por conexión) compartido por OAuth y los informes.
- **Vida absoluta de la autorización**: 180 días desde su creación, aunque se rote; después es `invalid_grant` y la autorización es purgable. Cierra el crecimiento ilimitado del historial de rotaciones.
- **Sin migración de datos previos**: nada se ha desplegado; la columna `resource` no lleva valor por defecto y no hay filas heredadas. El despliegue de producción crea el esquema con migraciones (fase 07).
