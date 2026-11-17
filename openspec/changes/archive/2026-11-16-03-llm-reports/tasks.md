## 1. Providers (repository)

- [x] 1.1 Interfaz `LlmProvider`, `LlmUnavailableError` y registro (spec: Provider abstraction)
- [x] 1.2 `OllamaProvider` y `DeepSeekProvider` con `fetch` inyectable y timeout (spec: Provider abstraction, Provider availability)
- [x] 1.3 Tests de cada proveedor con `fetch` simulado

## 2. Service

- [x] 2.1 `ReportGenerator`: prompts es/en, resumido/detallado, datos delimitados (spec: Report language and style)
- [x] 2.2 Valores por defecto de proveedor y modelo (spec: Defaults)
- [x] 2.3 `ReportsService` en la API: validación de rango, `NO_ACTIVITIES`, `UNKNOWN_PROVIDER`, `LLM_UNAVAILABLE` (spec: Report generation, Provider failure handling, Input validation)
- [x] 2.4 Tests del service
- [x] 2.5 Consulta de actividades para informe (rango, proyecto, tags, tope de 300) en `ActivitiesService`/`ActivitiesRepository` con una sola consulta (spec: Report size limit)

## 3. Controller

- [x] 3.1 `ReportsController`: `GET /reports/providers`, `POST /reports`
- [x] 3.2 Tests e2e de cada escenario con un proveedor falso

## 3b. Correcciones de la revisión

- [x] 3b.1 La API usa el registro de la librería (una sola fuente de proveedores); los factories leen su configuración del entorno
- [x] 3b.2 Los tags del informe se normalizan con la misma regla del service de actividades
- [x] 3b.3 Test de aborto real por timeout traducido a `LLM_UNAVAILABLE` y test de composición con el generador real y transporte simulado; `LLM_TIMEOUT_MS` documentado en `.env.example`
- [x] 3b.4 Escenarios de "Defaults" (modelo por defecto solo del proveedor por defecto) con test por escenario
- [x] 3b.5 Expandir declaraciones comprimidas (`report-options.ts`, `provider-registry.ts`)

- [x] 3b.6 Salida vacía o solo espacios del proveedor es fallo (`LLM_UNAVAILABLE`) en ambos proveedores y en el generador, con test
- [x] 3b.7 `model` con máximo 100 caracteres (validación)
- [x] 3b.8 Test de varios tags (ANY-of) que demuestre que coincide cada actividad con su tag

## 4. Bruno

- [x] 4.1 `.bru` para `reports/providers` y `reports` (es y en)

## 5. Revisión (trazabilidad)

- [x] 5.1 Revisión de diff por el arquitecto
- [x] 5.2 Revisión cruzada de cada endpoint y su `.bru` por un agente Codex distinto al autor

## 4b. Correcciones de Bruno

- [x] 4b.1 `tags: [requires-llm]` en el bloque `meta` de las dos peticiones con LLM para que `--exclude-tags requires-llm` funcione
- [x] 4b.2 Peticiones de tags ANY-of, estilo `detailed`, `model` de 101 caracteres (400) y `available:false` de un proveedor caído; `RANGE_TOO_LARGE` queda documentado como solo e2e
