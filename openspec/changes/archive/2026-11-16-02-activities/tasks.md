## 1. Repository

- [x] 1.1 Entidad `Activity` y `ActivitiesRepository` con filtros, paginación y `userId` obligatorio (spec: Activity listing and filters, Per-user isolation)
- [x] 1.2 Consulta de proyectos y tags distintos (spec: Activity metadata)
- [x] 1.3 Tests del repository

## 2. Service

- [x] 2.1 `ActivitiesService`: crear, leer, actualizar parcial, borrar (spec: Activity creation, Activity read, update and delete)
- [x] 2.2 Normalización de tags (spec: Tag normalization)
- [x] 2.3 Tests del service, incluido aislamiento entre usuarios

## 3. Controller

- [x] 3.1 `ActivitiesController` con DTOs validados (fecha, título, URLs, límites) y `GET /activities/meta` antes de `/:id`
- [x] 3.2 Tests e2e de cada escenario del spec

## 3b. Correcciones de revisión

- [x] 3b.1 La normalización de tags vive solo en el service (el filtro `tag` se normaliza en el service y el repository recibe el valor ya normalizado) (design-review)
- [x] 3b.2 Validadores de fecha y URL y restricciones compartidos entre DTOs de crear y actualizar (design-review)
- [x] 3b.3 Validación de fechas de filtro, rango invertido, PATCH vacío y límite de cuerpo con 413 `PAYLOAD_TOO_LARGE` (spec: Filter and body validation)
- [x] 3b.4 Tests con nombre de requisito y escenario, uno por escenario, aserciones fuertes (registros fuera de rango, `updatedAt` estrictamente mayor) (design-review)
- [x] 3b.5 Bruno: aserciones independientes del orden y de datos previos; casos de borde (orden con fechas iguales, `q` solo en descripción y comodines literales, paginación inválida, límites de creación, id no UUID, mass assignment, metadata aislada exacta, mensajes es/en, rango invertido, PATCH vacío)

## 4. Bruno

- [x] 4.1 Un `.bru` por endpoint en `bruno/taskory/activities` (list, create, get, patch, delete, meta)

## 5. Revisión (trazabilidad)

- [x] 5.1 Revisión de diff por el arquitecto (capas respetadas, sin N+1)
- [x] 5.2 Revisión cruzada de cada endpoint y su `.bru` por un agente Codex distinto al autor; hallazgos resueltos
