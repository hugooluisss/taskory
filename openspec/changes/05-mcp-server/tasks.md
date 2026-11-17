## 1. Repository

- [ ] 1.1 `TaskoryApiClient` (fetch inyectable, reenvía bearer, mapea errores) con tests (spec: Token forwarding)

## 2. Service

- [ ] 2.1 Servicios de herramientas: fecha por defecto, filtros, errores legibles (spec: log_activity, list_activities, update_activity and delete_activity, generate_report)
- [ ] 2.2 Tests de los services con cliente simulado

## 3. Controller

- [ ] 3.1 Servidor HTTP `/mcp`, 401 con `WWW-Authenticate` (resource_metadata) sin bearer o con token rechazado, servidor y transporte por petición (spec: MCP endpoint and authentication)
- [ ] 3.2 Registro de las 5 herramientas con zod y descripciones (spec: Tool descriptions guide the agent)
- [ ] 3.3 Test de integración MCP cliente-servidor con API simulada, incluida identidad por llamada

## 4. Revisión (trazabilidad)

- [ ] 4.1 Revisión de diff por el arquitecto
- [ ] 4.2 Revisión cruzada por un agente Codex distinto al autor, probando contra la API real de las fases 02-04
- [ ] 4.3 Prueba de conexión OAuth de extremo a extremo con un cliente MCP real (solo la URL, sin claves)
