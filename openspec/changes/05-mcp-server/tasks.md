## 1. Repository

- [x] 1.1 `TaskoryApiClient` (fetch inyectable, reenvía bearer, mapea errores) con tests (spec: Token forwarding)

## 2. Service

- [x] 2.1 Servicios de herramientas: fecha por defecto, filtros, errores legibles (spec: log_activity, list_activities, update_activity and delete_activity, generate_report)
- [x] 2.2 Tests de los services con cliente simulado

## 3. Controller

- [x] 3.1 Servidor HTTP `/mcp`, 401 con `WWW-Authenticate` (resource_metadata) sin bearer o con token rechazado, servidor y transporte por petición (spec: MCP endpoint and authentication)
- [x] 3.2 Registro de las 5 herramientas con zod y descripciones (spec: Tool descriptions guide the agent)
- [x] 3.3 Test de integración MCP cliente-servidor con API simulada, incluida identidad por llamada

- [x] 3.4 `generate_report` devuelve id y progreso ante 202 y herramienta `get_report` (spec: Asynchronous reports; depende de 03b-chunked-reports)

## 3b. Correcciones de la revisión de diseño

- [x] 3b.1 `TaskoryApiClient` expone métodos con nombre de intención (actividades e informes) y construye rutas, métodos HTTP y query strings; los services solo pasan argumentos de dominio
- [x] 3b.2 Sin caché de validación del token (validación en cada petición); se elimina `token-validation-cache` y se documenta
- [x] 3b.3 Preflight CORS antes de la validación del token y cabeceras expuestas (spec: Cross-origin preflight)
- [x] 3b.4 `list_activities` con `page` y mensaje de más páginas (spec: Paginated activity listing)
- [x] 3b.5 `log_activity` con `timezone` opcional (spec: User-local default date)
- [x] 3b.6 `UPSTREAM_UNAVAILABLE` para red, timeout y 5xx (spec: Upstream failures are distinguishable)
- [x] 3b.7 La API es la autoridad de las reglas de negocio: los esquemas del MCP validan forma, límites de tamaño y formato `YYYY-MM-DD`; sin duplicar la regla de calendario ni de URLs
- [x] 3b.8 `zod` actualizado a una versión sin el aviso alto si el SDK es compatible (si no, documentar la mitigación verificada)
- [x] 3b.9 Tests junto a su unidad (`*.test.ts`), con nombre de requisito y escenario, fecha determinista con reloj inyectado, límites y cierre en desconexión; README sin referencia a archivos inexistentes (`.env.example` presente)
- [x] 3b.10 Errores de validación bearer previos al despacho cumplen `UPSTREAM_UNAVAILABLE`, `RATE_LIMITED` y `UPSTREAM_REJECTED` con status y JSON-RPC estables (spec: Upstream failures are distinguishable)

## 4. Revisión (trazabilidad)

- [x] 4.1 Revisión de diff por el arquitecto
- [x] 4.2 Revisión cruzada por un agente Codex distinto al autor, probando contra la API real (con API keys; la parte OAuth queda en 4.3)
- [ ] 4.3 Prueba de conexión OAuth de extremo a extremo con un cliente MCP real (solo la URL, sin claves)
