## Why

El núcleo del producto es guardar lo que cada persona hace en su trabajo. El modelo debe ser genérico (no solo desarrollo) para servir a distintos tipos de trabajo.

## What Changes

- CRUD de actividades por usuario con filtros y paginación.
- Endpoint de metadatos (proyectos y etiquetas usados) para sugerencias.
- Endpoints añadidos a la colección Bruno.

## Capabilities

### New Capabilities
- `activities`: registro, consulta, edición y borrado de actividades aisladas por usuario.

### Modified Capabilities
(ninguna)

## Impact

- Código en `apps/api` (módulo de actividades) y `bruno/taskory/activities`.
- Depende de la fase `01-api-foundation-auth`. Consumido por las fases 03, 05 y 06.

## Non-goals

- Adjuntos, tiempos/duraciones, estados, compartir actividades entre usuarios.
