## Context

MCP oficial (`@modelcontextprotocol/sdk`), transporte streamable HTTP sin estado. Lección de la primera implementación: crear un `McpServer` y un transporte nuevos por petición y cerrarlos en `close`; reutilizar un transporte entre peticiones produce HTTP 500.

## Goals / Non-Goals

**Goals:** herramientas claras para el agente, identidad por llamada.
**Non-goals:** CLI, sesiones, caché.

## Decisions

- El token viaja en la cabecera de cada petición y se reenvía tal cual a la API.
- Esquemas con zod; descripciones orientadas a "cuándo usarla".
- `log_activity` calcula `date` por defecto con un timezone IANA recibido; si no se proporciona, usa el timezone del servidor.
- El token se valida con `GET /auth/me` en cada petición MCP y no se cachea: un token revocado debe recibir el desafío 401 en la siguiente petición.

## Arquitectura controller -> service -> repository

- Handlers de herramientas = controller: validan con zod, extraen el token y llaman a un service.
- `ActivityToolsService` / `ReportToolsService` = service: valores por defecto (fecha), armado de filtros, traducción de errores de la API a resultados de herramienta.
- `TaskoryApiClient` = repository: único lugar que hace `fetch` a la API REST con el bearer recibido.

## Risks / Trade-offs

- Cada llamada crea un servidor nuevo → costo despreciable al volumen esperado.
