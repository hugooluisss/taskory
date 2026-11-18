# Design

The API uses TypeORM's MySQL driver (`mysql2`) with required `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`, UTC timezone, utf8mb4, and a bounded connection pool. Migrations run at startup in every environment; synchronize is disabled. A single baseline migration creates the current schema, including JSON data, date columns, UTC millisecond timestamps, foreign keys, indexes, and a generated nullable active-job key with a unique index. Repository queries use MySQL JSON functions and the configured case-insensitive collation. Jest provisions isolated `dev_taskory_test*` databases per worker and runs repositories and e2e tests against MySQL.

Production data conversion and dev-container cutover are outside this API implementation and must be completed by operations before deployment.
