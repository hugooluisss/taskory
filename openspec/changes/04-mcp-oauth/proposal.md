## Why

La aplicación está pensada para personas no técnicas. Pedirles crear una API key y editar un JSON de configuración es una barrera. Con OAuth, el usuario solo añade la URL del servidor MCP en su agente, se abre el navegador, inicia sesión en Taskory, pulsa "Permitir" y el agente queda conectado.

## What Changes

- La API actúa como servidor de autorización OAuth 2.1 para clientes MCP: metadatos de descubrimiento, registro dinámico de clientes, autorización con PKCE, token y refresh, revocación.
- Pantalla de consentimiento (la sirve la web en la fase 06; esta fase define su contrato).
- Los access tokens OAuth se aceptan en el mismo guard que JWT y API keys.
- El usuario puede ver y revocar las aplicaciones conectadas.
- Las API keys de la fase 01 se mantienen como método avanzado.

## Capabilities

### New Capabilities
- `oauth-authorization`: descubrimiento, registro de clientes, flujo authorization code con PKCE, tokens y revocación.
- `connected-apps`: listado y revocación de aplicaciones autorizadas por el usuario.

### Modified Capabilities
(ninguna; los specs de las fases 01-03 aún no están archivados)

## Impact

- Código nuevo en `apps/api` (módulo `oauth`) y entradas Bruno en `bruno/taskory/oauth`.
- Depende de 01 (usuarios y guard). Lo consumen 05 (MCP), 06 (consentimiento y ajustes) y 07 (URL pública).
- Variable nueva: `PUBLIC_URL` (URL pública del servidor, base del issuer).

## Non-goals

- Scopes finos, OpenID Connect, login social (Google/GitHub), clientes confidenciales con secreto, múltiples issuers.
