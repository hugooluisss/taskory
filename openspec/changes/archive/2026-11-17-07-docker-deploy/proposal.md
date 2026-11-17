## Why

La aplicación se alojará en el servidor del usuario, así que debe poder construirse y levantarse con Docker de forma reproducible y segura.

## What Changes

- Dockerfiles para `api`, `mcp` y `web`.
- `docker-compose.yml` con volumen persistente para la base de datos y Ollama opcional.
- Variables de entorno documentadas y `.env.example`.

## Capabilities

### New Capabilities
- `deployment`: construcción, configuración y arranque en contenedores.

### Modified Capabilities
(ninguna)

## Impact

- Archivos en la raíz y en cada app. Depende de 01-06. Introduce `PUBLIC_URL` obligatoria y el enrutado de `/oauth`, `/.well-known` y `/mcp`.

## Non-goals

- Kubernetes, CI/CD, TLS (lo resuelve el proxy inverso del servidor).
