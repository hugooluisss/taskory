# MySQL persistence

## ADDED Requirements

### Requirement: API connects through MySQL environment configuration
The API SHALL connect to MySQL using required `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`, with utf8mb4, UTC timezone, and a bounded pool. Missing settings or an unreachable server SHALL produce a clear startup failure.

#### Scenario: Connects using DB environment variables
- **WHEN** all DB settings point to a reachable MySQL database
- **THEN** the API connects using the configured settings

#### Scenario: Startup rejects missing settings or an unreachable database
- **WHEN** a required DB setting is absent or MySQL cannot be reached
- **THEN** startup fails with a clear error

### Requirement: Schema is migration managed
The API SHALL run migrations at startup in every environment and SHALL NOT use synchronize. A single MySQL baseline SHALL create the complete current schema.

#### Scenario: Schema is created by migration
- **WHEN** the API starts against an empty database
- **THEN** migration creates the schema matching the entities

#### Scenario: Active report job uniqueness is enforced
- **WHEN** a user already has a queued or running report job
- **THEN** MySQL rejects another queued or running job for that user

### Requirement: MySQL query behavior preserves API semantics
Repository queries SHALL preserve any-match tag filtering, case-insensitive search, and `YYYY-MM-DD` date values. JSON queries SHALL be parameterized.

#### Scenario: Tag filters match any requested tag
- **WHEN** an activity contains at least one requested tag
- **THEN** it matches the tag filter

#### Scenario: Search is case-insensitive
- **WHEN** search text differs from stored title or description by letter case
- **THEN** the matching activity is returned

#### Scenario: Date columns remain calendar date strings
- **WHEN** a date is read from or written to MySQL
- **THEN** it remains a `YYYY-MM-DD` string without timezone conversion

### Requirement: Timestamps use UTC
Timestamp columns SHALL use millisecond precision and UTC values.

#### Scenario: Timestamps are UTC
- **WHEN** a timestamp is persisted and read
- **THEN** it represents the same UTC instant

### Requirement: API tests use MySQL
Unit repository, migration, and e2e tests SHALL use real MySQL test databases named `dev_taskory_test*` and SHALL not use SQLite.

#### Scenario: Tests run against MySQL
- **WHEN** tests run with the required DB environment variables
- **THEN** each Jest worker uses its own migrated MySQL test database
