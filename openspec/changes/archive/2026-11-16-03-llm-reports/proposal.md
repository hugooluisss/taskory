## Why

El objetivo del producto es generar informes de actividades con un modelo de IA, sin atarse a un proveedor: Ollama primero, DeepSeek y otros después.

## What Changes

- Paquete `packages/llm` con una abstracción de proveedor y adaptadores Ollama y DeepSeek.
- Generador de informes en Markdown, es/en, resumido o detallado.
- Endpoints `GET /reports/providers` y `POST /reports` en la API.
- Endpoints añadidos a Bruno.

## Capabilities

### New Capabilities
- `llm-providers`: contrato común de proveedor, registro y disponibilidad.
- `report-generation`: generación de informes a partir de las actividades del usuario.

### Modified Capabilities
(ninguna)

## Impact

- Código en `packages/llm`, módulo de reportes en `apps/api`, `bruno/taskory/reports`.
- Depende de las fases 01 y 02. Consumido por 05 y 06.
- Variables: `OLLAMA_BASE_URL`, `DEEPSEEK_API_KEY`, `DEFAULT_LLM_PROVIDER`, `DEFAULT_LLM_MODEL`.

## Non-goals

- Guardar informes, programación automática, streaming de respuesta.
