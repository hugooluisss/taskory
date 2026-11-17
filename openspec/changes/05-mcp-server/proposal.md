## Why

El agente del usuario debe poder registrar lo que se trabaja en el momento adecuado. El MVP expone solo MCP (sin CLI), y es multiusuario. Para usuarios no técnicos, la conexión se hace por OAuth (fase 04): basta con pegar la URL del servidor.

## What Changes

- Nuevo servidor MCP (`apps/mcp`) por HTTP con herramientas para registrar, consultar, editar y borrar actividades y generar informes.
- Reenvía el token de cada llamada a la API REST; no tiene credenciales propias.
- Responde 401 con `WWW-Authenticate` para iniciar el descubrimiento OAuth.

## Capabilities

### New Capabilities
- `mcp-tools`: herramientas MCP y su comportamiento de autenticación.

### Modified Capabilities
(ninguna)

## Impact

- Código en `apps/mcp`. Depende de 01, 02, 03 y 04 (API REST y OAuth).
- Variables: `TASKORY_API_URL`, `PUBLIC_URL`.

## Non-goals

- CLI, transporte stdio, estado de sesión, caché.
