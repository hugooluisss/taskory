## 1. Repositories

- [x] 1.1 Entidades y repositories de clientes, autorizaciones/solicitudes y tokens (hashes) con tests (spec: Token storage)

## 2. Services

- [x] 2.1 `ClientRegistrationService`: validación de redirect URIs (spec: Dynamic client registration)
- [x] 2.2 `OAuthService`: solicitud, decisión del usuario, código de un solo uso, PKCE S256 (spec: Authorization with PKCE, User consent)
- [x] 2.3 `OAuthService`: emisión de tokens, rotación de refresh, detección de reuso, revocación (spec: Token issuance, Refresh rotation, Revocation)
- [x] 2.4 Resolución de access token en el guard de la fase 01 (spec: OAuth tokens authenticate API calls)
- [x] 2.5 `ConnectedAppsService` (spec: connected-apps)
- [x] 2.6 Tests de cada escenario de los services, incluidos reuso de código, verifier incorrecto y aislamiento entre usuarios

## 3. Controllers

- [x] 3.1 Metadatos `/.well-known/oauth-authorization-server` y `/.well-known/oauth-protected-resource` desde `PUBLIC_URL` (spec: Discovery metadata)
- [x] 3.2 `POST /oauth/register`, `GET /oauth/authorize`, `POST /oauth/token`, `POST /oauth/revoke` con errores OAuth estándar
- [x] 3.3 `GET /api/v1/oauth/requests/:id` (datos para la pantalla) y `POST /api/v1/oauth/requests/:id/decision`
- [x] 3.4 `GET /api/v1/connected-apps` y `DELETE /api/v1/connected-apps/:id`
- [x] 3.5 Rate limit en register, token y decision (spec: Abuse limits)
- [x] 3.6 Tests e2e del flujo completo con un cliente simulado

## 3b. Endurecimiento tras la revisión de seguridad

- [x] 3b.1 Parámetro `resource` (RFC 8707): validación, persistencia en la autorización y exigencia en la API; `invalid_target` (spec: Resource binding)
- [x] 3b.2 Alcance único `taskory`, `invalid_scope` y `scopes_supported` en los metadatos (spec: Scope handling)
- [x] 3b.3 Reuso de código revoca la autorización completa, con el test exchange -> refresh -> replay (spec: Code replay revokes the whole grant)
- [x] 3b.4 Retención de evidencia de reuso y purga solo de autorizaciones muertas; sin borrar clientes con solicitudes pendientes (spec: Replay evidence retention)
- [x] 3b.5 `approve` booleano estricto con DTO (spec: Strict consent decision)
- [x] 3b.6 Aprobación atómica en una transacción de repository (spec: Atomic approval)
- [x] 3b.7 Registro: metadatos honestos y rechazo de caracteres de control en `redirect_uri` (spec: Registration metadata honesty)
- [x] 3b.8 Parámetro `iss` en respuestas redirigibles y metadato RFC 9207 (spec: Issuer identification)
- [x] 3b.9 Validación de `PUBLIC_URL` como emisor https en producción y `.env.example` coherente (spec: Issuer URL validation)
- [x] 3b.10 Límite de tasa en `/oauth/revoke` (spec: Revocation endpoint throttling)
- [x] 3b.11 Tests de las secuencias peligrosas y portar `tools/oauth-security-probe.mjs` a un e2e (`test/oauth-security.e2e-spec.ts`) con el script conservado como herramienta
- [x] 3b.12 Formato legible en archivos nuevos (una instrucción por línea)

## 3c. Segunda ronda de la revisión de seguridad

- [x] 3c.1 Ejecutor de transacciones serializado (una cola de promesas por conexión) usado por todos los repositories con escrituras múltiples de OAuth y de los informes; pruebas con solapamiento controlado de éxito y fallo (spec: Transaction isolation)
- [x] 3c.2 El consumo del código exige en la misma escritura condicional: código sin usar y vigente, autorización no revocada y recurso esperado (spec: Code exchange validates the grant atomically)
- [x] 3c.3 Vida absoluta de 180 días de la autorización, aplicada en el refresh y en la purga (spec: Absolute grant lifetime)
- [x] 3c.4 La consulta de consentimiento devuelve la URI de redirección completa, `clientId` y nombre (spec: Consent shows the full destination)
- [x] 3c.5 La columna `resource` sin valor por defecto; sin filas heredadas
- [x] 3c.6 Tests deterministas de las carreras (rotación concurrente: exactamente una rotación exitosa y luego revocación; purga con evidencia expirada y replay por separado; intercambios realmente concurrentes) y aserciones sobre las filas persistidas
- [x] 3c.7 Formato: decoradores y declaraciones en líneas separadas en las entidades y controladores nuevos

## 4. Bruno

- [x] 4.1 `.bru` en `bruno/taskory/oauth` para cada endpoint (metadatos, register, authorize, decision, token, refresh, revoke, connected-apps)

## 5. Revisión (trazabilidad)

- [x] 5.1 Revisión de diff por el arquitecto, con foco en seguridad (PKCE, redirect URIs, hashes, reuso)
- [x] 5.2 Revisión cruzada de seguridad (el agente ofensivo fue bloqueado por el proveedor del modelo; sustituida por pruebas propias en tools/oauth-security-probe.mjs y reviews/security-cross-review.md)
- [ ] 5.3 Verificación real con el cliente MCP del usuario (tras la fase 05)
