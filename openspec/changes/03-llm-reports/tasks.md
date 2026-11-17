## 1. Providers (repository)

- [ ] 1.1 Interfaz `LlmProvider`, `LlmUnavailableError` y registro (spec: Provider abstraction)
- [ ] 1.2 `OllamaProvider` y `DeepSeekProvider` con `fetch` inyectable y timeout (spec: Provider abstraction, Provider availability)
- [ ] 1.3 Tests de cada proveedor con `fetch` simulado

## 2. Service

- [ ] 2.1 `ReportGenerator`: prompts es/en, resumido/detallado, datos delimitados (spec: Report language and style)
- [ ] 2.2 Valores por defecto de proveedor y modelo (spec: Defaults)
- [ ] 2.3 `ReportsService` en la API: validación de rango, `NO_ACTIVITIES`, `UNKNOWN_PROVIDER`, `LLM_UNAVAILABLE` (spec: Report generation, Provider failure handling, Input validation)
- [ ] 2.4 Tests del service

## 3. Controller

- [ ] 3.1 `ReportsController`: `GET /reports/providers`, `POST /reports`
- [ ] 3.2 Tests e2e de cada escenario con un proveedor falso

## 4. Bruno

- [ ] 4.1 `.bru` para `reports/providers` y `reports` (es y en)

## 5. Revisión (trazabilidad)

- [ ] 5.1 Revisión de diff por el arquitecto
- [ ] 5.2 Revisión cruzada de cada endpoint y su `.bru` por un agente Codex distinto al autor
