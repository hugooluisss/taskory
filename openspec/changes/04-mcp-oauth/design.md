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
