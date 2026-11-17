## ADDED Requirements

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
List endpoints SHALL return `{ items, total, page, limit }`, with `page` default 1, `limit` default 50 and `limit` capped at 200.

#### Scenario: Limit above cap
- **WHEN** a client requests `limit=1000`
- **THEN** the response uses `limit` 200
