## 1. Librería (packages/llm)

- [ ] 1.1 Tipos de memoria y de salida de lote (`ChunkEvaluation`, `Highlight`) y validador manual de la salida del proveedor (spec: Chunk evaluation output, Invalid provider output)
- [ ] 1.2 `ReportGenerator.evaluateChunk`: prompt es/en con criterio de impacto genérico, JSON forzado cuando el proveedor lo permite, máximo de highlights, reintento ante salida inválida
- [ ] 1.3 `ReportGenerator.writeFinal` y consolidación jerárquica de la memoria (spec: Final report from memory, Memory too large)
- [ ] 1.4 Tests Vitest de cada escenario con `fetch` simulado (salida inválida, id desconocido, memoria grande)

## 2. Repositories (API)

- [ ] 2.1 Entidades `ReportJob` y `ReportMemory` y sus repositories con acceso siempre por `userId`
- [ ] 2.2 Consulta de instantánea de ids de actividades del informe y consulta de actividades por lote en una sola consulta
- [ ] 2.3 Tests de repository sobre SQLite temporal

## 3. Services (API)

- [ ] 3.1 `ReportsService`: decide una pasada (≤100) o trabajo (>100) y aplica el tope de 3000 (spec: Single pass, Report size limit)
- [ ] 3.2 `ReportJobsService`: estados, progreso, límites de concurrencia, reintento, borrado, retención (spec: Report job status, Retry, Concurrency limits, Delete a report, Retention)
- [ ] 3.3 `ReportJobRunner`: ejecuta lotes en orden, persiste memoria, totales deterministas, reduce, interrupción al arrancar (spec: Chunked generation, Report memory, Final report from memory)
- [ ] 3.4 Tests de services con generador y repositories falsos, incluida la reanudación de 4 de 7 lotes

## 4. Controllers (API)

- [ ] 4.1 `POST /reports` responde 200 o 202; `GET /reports/:id`, `POST /reports/:id/retry`, `DELETE /reports/:id`
- [ ] 4.2 Mensajes es/en para `REPORT_IN_PROGRESS`, `REPORT_NOT_RETRYABLE`, `INVALID_LLM_OUTPUT`
- [ ] 4.3 Tests e2e de cada escenario con generador falso (aislamiento entre usuarios incluido)

## 5. Bruno

- [ ] 5.1 Peticiones en `bruno/taskory/reports` para 202 con más de 100 actividades (con generador falso en el servidor de pruebas), polling hasta `completed`, retry de un trabajo no fallido (409), foreign (404), delete (204)

## 6. Efectos en otras fases

- [ ] 6.1 Fase 05 (MCP): herramienta `get_report` y `generate_report` que devuelve el estado cuando el informe es asíncrono
- [ ] 6.2 Fase 06 (web): barra de progreso, sondeo, reintento y borrado de informes

## 7. Revisión (trazabilidad)

- [ ] 7.1 Revisión de diff por el arquitecto
- [ ] 7.2 `design-review` con un agente Codex
- [ ] 7.3 Revisión cruzada de cada endpoint y su `.bru` por un agente Codex distinto al autor
