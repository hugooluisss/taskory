# Migrate persistence to MySQL

Replace SQLite persistence in the API with MySQL 8.4 while preserving the API contract and stored behavior. Use environment-based connection settings, a single baseline migration for the current schema, and MySQL-backed API tests. Operations and data cutover are coordinated separately.

## Scope

API and test persistence, schema migration, SQL queries, configuration and documentation. Production data migration and dev-stack cutover are owned by operations.
