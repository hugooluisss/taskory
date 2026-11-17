## Context

`packages/llm` es una librería TS sin dependencias; la API la consume como `@taskory/llm` (`file:../../packages/llm`).

## Goals / Non-Goals

**Goals:** proveedor intercambiable, informe en es/en.
**Non-goals:** persistir informes, streaming.

## Decisions

- Interfaz `LlmProvider { id, defaultModel, isAvailable(), complete() }` y un registro `id -> factory`. Añadir proveedor = una clase + una línea.
- `fetch` inyectable para tests sin red.
- Las actividades se envían al modelo como datos delimitados, con instrucción de tratarlas como datos y no como órdenes (mitiga inyección desde descripciones).
- Un proveedor desconocido es `UNKNOWN_PROVIDER` (400), distinto de `LLM_UNAVAILABLE` (502).
- Timeout configurable por llamada.

## Arquitectura controller -> service -> repository

- `ReportsController` (API): valida DTO y llama a `ReportsService`.
- `ReportsService` (API): reglas (rango válido, 422 si no hay actividades) y orquesta; lee actividades vía `ActivitiesService`, nunca vía el repository de otro módulo.
- `ReportGenerator` (`packages/llm`) = service de generación; los providers (`OllamaProvider`, `DeepSeekProvider`) = repositories hacia el LLM.

## Risks / Trade-offs

- Modelos locales lentos → timeout y error 502 claro.
- Informes grandes exceden contexto → fuera de alcance; se limita el número de actividades por informe y se documenta.
