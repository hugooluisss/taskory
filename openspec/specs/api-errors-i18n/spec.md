# api-errors-i18n Specification

## Purpose
TBD - created by archiving change 01-api-foundation-auth. Update Purpose after archive.

## Requirements

### Requirement: Uniform error format
Every error response SHALL have the shape `{ statusCode, code, message }` where `code` is a stable SNAKE_CASE identifier.

#### Scenario: Validation failure
- **WHEN** a request body fails validation
- **THEN** the response has `statusCode` 400, `code` `VALIDATION_ERROR` and a human-readable `message`

### Requirement: Localized messages
The system SHALL localize `message` using the `Accept-Language` header, supporting `es` and `en`, defaulting to `en`.

#### Scenario: Spanish client
- **WHEN** a request sends `Accept-Language: es` and triggers an error
- **THEN** `message` is in Spanish and `code` is unchanged

#### Scenario: Unsupported language
- **WHEN** the header requests another language
- **THEN** `message` is in English

### Requirement: Pagination envelope
Paginated list endpoints (activities) SHALL return `{ items, total, page, limit }`, with `page` default 1, `limit` default 50 and `limit` capped at 200. Small bounded lists (API keys, connected apps, providers) return a plain array and are not paginated.

#### Scenario: Limit above cap
- **WHEN** a client requests `limit=1000`
- **THEN** the response uses `limit` 200

### Requirement: Input length limits
The system SHALL reject user `name` values longer than 100 characters and API key `name` values longer than 100 characters.

#### Scenario: Oversized name
- **WHEN** a client sends a `name` of 101 or more characters to register, update the profile or create an API key
- **THEN** the system responds 400 with code `VALIDATION_ERROR`
