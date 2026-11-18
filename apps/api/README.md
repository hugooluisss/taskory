# Taskory API

The API uses MySQL 8.4 via TypeORM. Set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`; all are required. The connection uses utf8mb4, UTC, and a bounded pool. Schema changes run through migrations at startup; synchronize is disabled in every environment.

For local tests, provide MySQL credentials for a user allowed to create/drop databases named `dev_taskory_test*`. Run `npm test`, `npm run test:e2e`, or `npm run test:cov` from this directory. Point `DB_HOST` to `127.0.0.1` when MySQL runs on the host.
