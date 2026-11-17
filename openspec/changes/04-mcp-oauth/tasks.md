## 1. Repositories

- [ ] 1.1 Entidades y repositories de clientes, autorizaciones/solicitudes y tokens (hashes) con tests (spec: Token storage)

## 2. Services

- [ ] 2.1 `ClientRegistrationService`: validación de redirect URIs (spec: Dynamic client registration)
- [ ] 2.2 `OAuthService`: solicitud, decisión del usuario, código de un solo uso, PKCE S256 (spec: Authorization with PKCE, User consent)
- [ ] 2.3 `OAuthService`: emisión de tokens, rotación de refresh, detección de reuso, revocación (spec: Token issuance, Refresh rotation, Revocation)
- [ ] 2.4 Resolución de access token en el guard de la fase 01 (spec: OAuth tokens authenticate API calls)
- [ ] 2.5 `ConnectedAppsService` (spec: connected-apps)
- [ ] 2.6 Tests de cada escenario de los services, incluidos reuso de código, verifier incorrecto y aislamiento entre usuarios

## 3. Controllers

- [ ] 3.1 Metadatos `/.well-known/oauth-authorization-server` y `/.well-known/oauth-protected-resource` desde `PUBLIC_URL` (spec: Discovery metadata)
- [ ] 3.2 `POST /oauth/register`, `GET /oauth/authorize`, `POST /oauth/token`, `POST /oauth/revoke` con errores OAuth estándar
- [ ] 3.3 `GET /api/v1/oauth/requests/:id` (datos para la pantalla) y `POST /api/v1/oauth/requests/:id/decision`
- [ ] 3.4 `GET /api/v1/connected-apps` y `DELETE /api/v1/connected-apps/:id`
- [ ] 3.5 Rate limit en register, token y decision (spec: Abuse limits)
- [ ] 3.6 Tests e2e del flujo completo con un cliente simulado

## 4. Bruno

- [ ] 4.1 `.bru` en `bruno/taskory/oauth` para cada endpoint (metadatos, register, authorize, decision, token, refresh, revoke, connected-apps)

## 5. Revisión (trazabilidad)

- [ ] 5.1 Revisión de diff por el arquitecto, con foco en seguridad (PKCE, redirect URIs, hashes, reuso)
- [ ] 5.2 Revisión cruzada por un agente Codex distinto al autor de cada endpoint y su `.bru`
- [ ] 5.3 Verificación real con el cliente MCP del usuario (tras la fase 05)
