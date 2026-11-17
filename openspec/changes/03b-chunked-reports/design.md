## Context

Fase 03 genera el informe con una sola llamada y topa en 300 actividades. Los modelos locales (Ollama) tienen contexto reducido y tardan; un trimestre puede tener miles de actividades. Patrón elegido: map-reduce con memoria persistida.

## Goals / Non-Goals

**Goals:** informes de rangos largos sin desbordar el contexto; progreso visible; reanudable; sin infraestructura nueva.
**Non-goals:** cola externa, varios workers, edición de memoria.

## Decisions

- **Umbral**: ≤100 actividades, una pasada síncrona (sin cambios para el caso común). >100, por lotes de 100 ordenados por fecha. Tope global 3000 (30 lotes). Constantes en un solo módulo.
- **Map**: por lote se pide JSON `{summary, highlights:[{activityId, impact:'high'|'medium', reason}]}`. El criterio de impacto se describe de forma genérica (resultados entregados, incidentes resueltos, trabajo visible para terceros, decisiones, bloqueos eliminados) para servir a cualquier tipo de trabajo, no solo desarrollo. Máximo 15 highlights por lote. La salida se valida (zod no está disponible en `packages/llm`, que no tiene dependencias: validador manual pequeño). Ids desconocidos descartan el lote y reintentan.
- **Memoria**: tabla `report_memory` (reportId, chunkIndex, dateFrom, dateTo, activityCount, summary, highlights JSON). Los highlights guardan una copia mínima (id, fecha, título, proyecto, reason, impact) para que el reduce no necesite las actividades originales.
- **Totales deterministas**: actividades por proyecto y por día se calculan en código y se entregan al reduce; el modelo no cuenta.
- **Reduce**: prompt con memoria + totales. Si la memoria supera 100 highlights, se consolida por grupos de lotes (reduce jerárquico, un nivel basta con el tope de 3000) y luego se redacta.
- **Trabajos asíncronos en proceso**: un ejecutor en la API con concurrencia 2 global y 1 activo por usuario. Sin cola externa. Al arrancar, los trabajos `running` pasan a `failed/INTERRUPTED` (la memoria queda y se reanuda con retry). `ponytail:` ejecutor en memoria; migrar a cola externa si se necesita más de un proceso.
- **Reintento por lote**: 2 reintentos por lote ante salida inválida o fallo del proveedor; después el trabajo falla con el índice del lote. `POST /reports/:id/retry` reanuda desde el primer lote sin memoria.
- **Instantánea**: al crear el trabajo se fija la lista ordenada de ids de actividades (tabla o JSON) para que ediciones durante el trabajo no cambien los lotes.
- **Retención**: borrado de trabajos terminados a los 30 días, ejecutado al arrancar y diariamente.
- **Respuesta de POST /reports**: 200 si ≤100, 202 si >100. Mismo endpoint, el cliente distingue por status.

## Arquitectura controller -> service -> repository

- `packages/llm`: `ReportGenerator` sigue siendo el service; añade `evaluateChunk` y `consolidate`/`writeFinal`; los providers siguen siendo los repositories.
- API: `ReportsController` -> `ReportsService` (decide una pasada o por fases, validaciones) -> `ReportJobsService` (ciclo de vida, reglas de concurrencia y reintento) -> `ReportJobsRepository` y `ReportMemoryRepository` (única capa con TypeORM). El ejecutor (`ReportJobRunner`) usa los services, no los repositories de otros módulos.
- Actividades se obtienen vía `ActivitiesService`.

## Risks / Trade-offs

- Un lote de 100 actividades largas puede exceder el contexto de un modelo pequeño → el tamaño del lote es una constante ajustable por `REPORT_CHUNK_SIZE`.
- Modelos pequeños devuelven JSON inválido con frecuencia → reintentos y mensaje de error por lote; considerar formato JSON forzado del proveedor (`format: json` en Ollama).
- La calidad del criterio de "alto impacto" depende del modelo → el usuario puede ver las highlights en el informe final (sección de evidencias con enlaces a sus actividades).
- Ejecutor en proceso se pierde al reiniciar → reanudable por diseño.

## Open Questions

Ninguna bloqueante.
