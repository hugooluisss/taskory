# Tasks

## API / tests (p16-mysql-api)
- [x] 1. Replace SQLite driver/configuration with required MySQL DB_* configuration and startup validation.
- [x] 2. Replace SQLite migrations with one MySQL baseline migration and use migrations in all environments.
- [x] 3. Port repository SQL and JSON entity types to MySQL while preserving behavior.
- [x] 4. Run unit, migration, and e2e tests against isolated MySQL databases; update API documentation.
- [x] 5. Build and run API test and coverage gates against MySQL.

## Ops / data (p17)
- [x] 6. Prepare production backup and data migration to MySQL 8.4 without accessing databases outside `dev_taskory*`.
- [x] 7. Coordinate the dev-stack database cutover after API implementation is reviewed.
- [x] 8. Document and verify deployment connection settings and rollback procedure.
