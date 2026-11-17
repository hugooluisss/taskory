## 1. Librería (packages/llm)

- [x] 1.1 Tipos de memoria y de salida de lote (`ChunkEvaluation`, `Highlight`) y validador manual de la salida del proveedor (spec: Chunk evaluation output, Invalid provider output)
- [x] 1.2 `ReportGenerator.evaluateChunk`: prompt es/en con criterio de impacto genérico, JSON forzado cuando el proveedor lo permite, máximo de highlights, reintento ante salida inválida
- [x] 1.3 `ReportGenerator.writeFinal` y consolidación jerárquica de la memoria (spec: Final report from memory, Memory too large)
- [x] 1.4 Tests Vitest de cada escenario con `fetch` simulado (salida inválida, id desconocido, memoria grande)

## 2. Repositories (API)

- [x] 2.1 Entidades `ReportJob` y `ReportMemory` y sus repositories con acceso siempre por `userId`
- [x] 2.2 Consulta de instantánea de ids de actividades del informe y consulta de actividades por lote en una sola consulta
- [x] 2.3 Tests de repository sobre SQLite temporal

## 3. Services (API)

- [x] 3.1 `ReportsService`: decide una pasada (≤100) o trabajo (>100) y aplica el tope de 3000 (spec: Single pass, Report size limit)
- [x] 3.2 `ReportJobsService`: estados, progreso, límites de concurrencia, reintento, borrado, retención (spec: Report job status, Retry, Concurrency limits, Delete a report, Retention)
- [x] 3.3 `ReportJobRunner`: ejecuta lotes en orden, persiste memoria, totales deterministas, reduce, interrupción al arrancar (spec: Chunked generation, Report memory, Final report from memory)
- [x] 3.4 Tests de services con generador y repositories falsos, incluida la reanudación de 4 de 7 lotes

## 4. Controllers (API)

- [x] 4.1 `POST /reports` responde 200 o 202; `GET /reports/:id`, `POST /reports/:id/retry`, `DELETE /reports/:id`
- [x] 4.2 Mensajes es/en para `REPORT_IN_PROGRESS`, `REPORT_NOT_RETRYABLE`, `INVALID_LLM_OUTPUT`
- [x] 4.3 Tests e2e de cada escenario con generador falso (aislamiento entre usuarios incluido)

## 5. Bruno

- [x] 5.1 Peticiones en `bruno/taskory/reports` para 202 con más de 100 actividades (con generador falso en el servidor de pruebas), polling hasta `completed`, retry de un trabajo no fallido (409), foreign (404), delete (204)

## 5b. Correcciones de la revisión de diseño

- [x] 5b.1 Memoria con `userId`, clave foránea en cascada y transacciones; guardado de memoria de un trabajo borrado falla de forma controlada
- [x] 5b.2 Índice único parcial de un trabajo activo por usuario y transición atómica del reintento; deduplicación en cola y en ejecución
- [x] 5b.3 Cancelación con `AbortSignal` desde el puerto hasta cada petición de la librería, con `ReportCancelledError` (API)
- [x] 5b.4 Errores del puerto y adaptador `LlmReportGeneratorAdapter`; el ejecutor no importa la librería
- [x] 5b.5 Recuperación solo de `running`, despacho de `queued` y arranque con orden explícito sin callbacks
- [x] 5b.6 Reintentos de la librería también ante fallos del proveedor
- [x] 5b.7 Datos de usuario y de modelo siempre dentro de bloques JSON escapados con instrucción de datos en las tres etapas
- [x] 5b.8 Límites de tamaño (resumen 600, razón 240) y presupuesto de caracteres en la consolidación
- [x] 5b.9 Ollama falso devuelve como máximo 15 highlights en consolidación
- [x] 5b.10 `ErrorsFilter` con lista blanca de campos de detalle
- [x] 5b.11 Tests deterministas (promesas diferidas, reinicio real del módulo, carreras, cancelación durante reintentos) y nombres según el spec

## 5c. Ronda final de correcciones (revisión de diseño ronda 2 y revisión cruzada)

- [x] 5c.1 Los repositories traducen los errores de restricción de SQLite a errores propios; ni el service ni el runner interpretan códigos del driver
- [x] 5c.2 Borrado de un trabajo en cola coordinado con el despacho (sin reencolado tras borrar, con prueba de ambos órdenes con promesas diferidas)
- [x] 5c.3 El hueco de concurrencia y el id activo se liberan en `finally` aunque falle la escritura del estado de fallo o la recarga de la cola, con pruebas
- [x] 5c.4 La librería se construye solo dentro del adaptador (una única frontera con la librería)
- [x] 5c.5 Presupuesto de la consolidación medido sobre el prompt serializado real y sobre la memoria total; un lote demasiado grande se divide o se rechaza; el informe final nunca excede el presupuesto; con pruebas que inspeccionan tamaños y contenido
- [x] 5c.6 Pruebas con nombre de requisito y escenario del spec; aserciones fuertes en el informe final; sangrías corregidas (API y packages/llm)
- [x] 5c.7 Pruebas con nombre: estado de un trabajo en ejecución (forma y `0 <= done <= total`) y mensaje en español de `INVALID_LLM_OUTPUT`
- [x] 5c.8 Bruno: la petición de 250 actividades crea 250 y comprueba `progress.total` 3; borrado con el trabajo activo (modo lento); GET de un trabajo en ejecución; mensaje español de `INVALID_LLM_OUTPUT`
- [x] 5c.9 Decisión registrada: no hay migración del índice único porque no existen bases de datos anteriores a este cambio

## 6. Efectos en otras fases

No se implementan aquí: están como tareas propias en `05-mcp-server` (3.4, `get_report`) y `06-web-app` (4.3b, progreso, reintento y borrado).

## 7. Revisión (trazabilidad)

- [x] 7.1 Revisión de diff por el arquitecto
- [x] 7.2 `design-review` con un agente Codex
- [x] 7.3 Revisión cruzada de cada endpoint y su `.bru` por un agente Codex distinto al autor
