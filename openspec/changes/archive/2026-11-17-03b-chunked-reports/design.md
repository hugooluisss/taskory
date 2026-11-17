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

## Contrato entre librería, API y herramientas (fijo para trabajo en paralelo)

```ts
// packages/llm
interface ReportActivity { id; date; title; description; referenceUrls; tags; project }   // ya existe
interface Highlight { activityId: string; date: string; title: string; project: string | null;
                      impact: 'high' | 'medium'; reason: string }
interface ChunkEvaluation { summary: string; highlights: Highlight[]; provider: string; model: string }
interface MemoryChunk { chunkIndex: number; dateFrom: string; dateTo: string; activityCount: number;
                        summary: string; highlights: Highlight[] }
interface ReportTotals { byProject: Record<string, number>; byDay: Record<string, number> }

ReportGenerator.evaluateChunk({ activities: ReportActivity[], language, provider?, model? }): Promise<ChunkEvaluation>
ReportGenerator.writeFinal({ memory: MemoryChunk[], totals: ReportTotals, from, to, project?, language,
                             style, provider?, model? }): Promise<{ markdown, provider, model }>
// writeFinal consolida internamente si la memoria tiene más de 100 highlights.
// El modelo solo devuelve activityId, impact y reason; la librería completa date/title/project desde el lote.
// Salida inválida, id desconocido o vacía => se reintenta 2 veces y luego LlmUnavailableError / InvalidLlmOutputError.
```

- En la API el service depende de un puerto `ReportGeneratorPort` (interfaz propia con estas firmas, además de `generate` y `listProviders`/`hasProvider`); `ReportGenerator` real lo cumple estructuralmente. Los tests de la API usan un generador falso.
- Los prompts empiezan con una línea marcadora: `TASK: CHUNK_EVALUATION`, `TASK: CONSOLIDATION` o `TASK: FINAL_REPORT`. Las evaluaciones y consolidaciones piden JSON puro (Ollama: `format: "json"`; DeepSeek: `response_format json_object`); `CompleteInput` gana `json?: boolean`.
- `tools/fake-ollama/server.mjs` (sin dependencias) imita `/api/tags` y `/api/chat` según el marcador, para pruebas e2e y Bruno sin modelo real.

## Decisiones tras la revisión de diseño (ronda 2)

- **Presupuesto de memoria en la librería**: el límite de 12 000 caracteres se mide sobre el texto real de cada prompt enviado (sistema + prompt, con JSON indentado, totales e instrucciones fijas). Se truncan highlights de una memoria individual que excede el límite, conservando primero los de impacto alto e indicando cuántos se omitieron en el resumen. La consolidación se repite jerárquicamente hasta cuatro niveles; si no reduce lo suficiente para que quepa el prompt final, se lanza `InvalidLlmOutputError`.

- **Cancelación**: `evaluateChunk` y `writeFinal` aceptan `signal?: AbortSignal`; la librería la comprueba antes de cada petición al proveedor (incluidos reintentos y grupos de consolidación) y la pasa al `fetch` combinada con el timeout; un aborto lanza `ReportCancelledError`. El trabajo borrado nunca inicia otra petición.
- **Un trabajo activo por usuario, atómico**: índice único parcial en `report_job(userId) WHERE status IN ('queued','running')`; la violación se traduce a `REPORT_IN_PROGRESS`. El reintento hace la transición `failed -> queued` con un `UPDATE ... WHERE status='failed'` y comprueba filas afectadas. El ejecutor deduplica ids en cola y en ejecución.
- **Memoria**: `report_memory` lleva `userId` además de `reportId`, clave foránea con `ON DELETE CASCADE` hacia `report_job`, todas las consultas filtran por ambos; borrar un trabajo y su memoria es una sola transacción; guardar memoria de un trabajo inexistente falla por la clave foránea y el ejecutor lo trata como cancelado.
- **Puerto de errores**: el puerto `ReportGeneratorPort` define sus propios errores (`ReportGenerationError` con `code` `LLM_UNAVAILABLE` | `INVALID_LLM_OUTPUT`) y un adaptador (`LlmReportGeneratorAdapter implements ReportGeneratorPort`) traduce los errores de la librería; el ejecutor solo conoce el puerto.
- **Arranque y recuperación**: solo los trabajos `running` pasan a `failed/INTERRUPTED`; los `queued` se despachan tras la recuperación; sin registro de callbacks entre servicios (sin dependencia circular): un único componente de arranque con orden explícito.
- **Reintentos de la librería**: hasta 2 reintentos tanto ante salida inválida como ante fallo del proveedor; se conserva el último tipo de error.
- **Prompts**: todo texto de usuario o de modelo (títulos, proyecto, razones, resúmenes) va dentro de bloques JSON escapados y delimitados; cada etapa (evaluación, consolidación, informe final) incluye la instrucción de tratar ese contenido como datos.
- **Tamaños**: resumen máximo 600 caracteres y razón máxima 240; las consolidaciones agrupan además por presupuesto de caracteres (constante), no solo por número de highlights.
- **ErrorsFilter**: lista blanca explícita de campos de detalle; el `message` localizado nunca se sobrescribe.
- **Tests**: sin `sleep` ni sondeo por tiempo real; promesas diferidas controladas, reinicio real del módulo sobre la misma base para el arranque, y pruebas de carrera.
