## Why

Un informe por rango de fechas puede incluir cientos o miles de actividades, más de lo que cabe en el contexto de un modelo (sobre todo locales con Ollama). La fase 03 lo evita con un tope de 300 actividades. Para informes largos (mes, trimestre, año) el informe debe generarse por fases: el modelo evalúa lotes de 100 actividades, selecciona las de alto impacto y esa selección forma la "memoria" del informe; al terminar el recorrido, la memoria se analiza para redactar el informe final.

## What Changes

- Informes de hasta 100 actividades siguen generándose en una sola pasada (comportamiento de la fase 03).
- Informes de más de 100 actividades se generan por lotes de 100 (fase "map"): cada lote produce un resumen y las actividades de alto impacto, que se guardan como memoria del informe.
- Fase final ("reduce"): el modelo redacta el informe a partir de la memoria. Si la memoria es demasiado grande, se consolida por grupos antes de redactar (reducción jerárquica).
- Como tarda minutos, la generación por fases es un trabajo asíncrono: `POST /reports` responde 202 con un `id`; `GET /reports/:id` entrega estado, progreso y resultado; se puede reintentar un trabajo fallido reanudando desde el primer lote incompleto, y borrar un informe.
- El tope de la fase 03 (300 actividades, `RANGE_TOO_LARGE`) pasa a 3000.
- `packages/llm` añade evaluación de lote y consolidación con salida JSON validada.
- Impacto en MCP (herramienta para consultar un informe) y web (progreso y reintento).

## Capabilities

### New Capabilities
- `chunked-report-generation`: generación por lotes, memoria del informe, trabajos asíncronos, progreso, reintento y borrado.

### Modified Capabilities
- `report-generation`: el requisito "Report size limit" cambia (de 300 a 3000 actividades y de rechazo a generación por fases).

## Impact

- `packages/llm`: nuevas operaciones de lote y consolidación.
- `apps/api`: tablas de informe y memoria, ejecutor de trabajos en proceso, endpoints `GET/DELETE /reports/:id`, `POST /reports/:id/retry`.
- `bruno/taskory/reports`: nuevas peticiones.
- Fases 05 (MCP) y 06 (web) incorporan el flujo asíncrono.
- Depende de la fase 03 archivada.

## Non-goals

- Cola externa (Redis, BullMQ), varios workers, programación periódica de informes, edición manual de la memoria, compartir informes entre usuarios.
