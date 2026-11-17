## 1. Repository

- [ ] 1.1 Entidad `Activity` y `ActivitiesRepository` con filtros, paginación y `userId` obligatorio (spec: Activity listing and filters, Per-user isolation)
- [ ] 1.2 Consulta de proyectos y tags distintos (spec: Activity metadata)
- [ ] 1.3 Tests del repository

## 2. Service

- [ ] 2.1 `ActivitiesService`: crear, leer, actualizar parcial, borrar (spec: Activity creation, Activity read, update and delete)
- [ ] 2.2 Normalización de tags (spec: Tag normalization)
- [ ] 2.3 Tests del service, incluido aislamiento entre usuarios

## 3. Controller

- [ ] 3.1 `ActivitiesController` con DTOs validados (fecha, título, URLs, límites) y `GET /activities/meta` antes de `/:id`
- [ ] 3.2 Tests e2e de cada escenario del spec

## 4. Bruno

- [ ] 4.1 Un `.bru` por endpoint en `bruno/taskory/activities` (list, create, get, patch, delete, meta)

## 5. Revisión (trazabilidad)

- [ ] 5.1 Revisión de diff por el arquitecto (capas respetadas, sin N+1)
- [ ] 5.2 Revisión cruzada de cada endpoint y su `.bru` por un agente Codex distinto al autor; hallazgos resueltos
