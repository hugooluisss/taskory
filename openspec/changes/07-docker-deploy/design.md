## Context

Tres servicios Node/estáticos más Ollama opcional. Un solo servidor personal.

## Goals / Non-Goals

**Goals:** arranque reproducible, datos persistentes, sin secretos en imágenes.
**Non-goals:** orquestación avanzada, TLS propio.

## Decisions

- Builds multi-etapa; imágenes finales mínimas y usuario no root.
- Web servida por nginx con proxy `/api/v1 -> api` (mismo origen, sin CORS) y `assets/config.json` estático de mismo origen; no se genera al arrancar.
- El puerto web del host se enlaza a `127.0.0.1` por defecto para que solo sea accesible mediante el proxy TLS del host.
- Volumen nombrado para SQLite; `JWT_SECRET` obligatorio.
- Ollama bajo `profiles: ["ollama"]`.
- El perfil Ollama incluye un servicio de una sola ejecución que descarga el modelo configurado después de que Ollama esté saludable; la API no depende de ese perfil.
- `TRUST_PROXY_HOPS` cuenta cada proxy confiable desde la API hacia el cliente, incluido nginx: 1 sin proxy externo y 2 con uno.

## Arquitectura controller -> service -> repository

No aplica código nuevo de aplicación; esta fase solo empaqueta las capas existentes. Se verifica que ninguna configuración de despliegue exija saltarse las capas (p. ej. el MCP solo habla con la API, no con la base de datos).

## Risks / Trade-offs

- SQLite en volumen único impide escalar horizontalmente → aceptado.
