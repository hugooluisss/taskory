## Context

Tres servicios Node/estáticos más Ollama opcional. Un solo servidor personal.

## Goals / Non-Goals

**Goals:** arranque reproducible, datos persistentes, sin secretos en imágenes.
**Non-goals:** orquestación avanzada, TLS propio.

## Decisions

- Builds multi-etapa; imágenes finales mínimas y usuario no root.
- Web servida por nginx con proxy `/api/v1 -> api` (mismo origen, sin CORS) y `config.json` generado al arrancar.
- Volumen nombrado para SQLite; `JWT_SECRET` obligatorio.
- Ollama bajo `profiles: ["ollama"]`.

## Arquitectura controller -> service -> repository

No aplica código nuevo de aplicación; esta fase solo empaqueta las capas existentes. Se verifica que ninguna configuración de despliegue exija saltarse las capas (p. ej. el MCP solo habla con la API, no con la base de datos).

## Risks / Trade-offs

- SQLite en volumen único impide escalar horizontalmente → aceptado.
