## ADDED Requirements

### Requirement: API key creation
The system SHALL let an authenticated user create a named personal API key whose value starts with `tk_` and is returned in plaintext exactly once.

#### Scenario: Create key
- **WHEN** an authenticated user sends `POST /api/v1/api-keys` with a `name`
- **THEN** the system responds 201 with `id`, `name` and the full `key`

#### Scenario: Key is never shown again
- **WHEN** the user lists their keys
- **THEN** each entry has `id`, `name`, `prefix`, `createdAt` and `lastUsedAt` but never the full key

### Requirement: API key storage
The system MUST store API keys only as hashes.

#### Scenario: Database leak
- **WHEN** the database content is inspected
- **THEN** no plaintext key can be recovered

### Requirement: API key authentication
The system SHALL accept a valid API key as `Authorization: Bearer tk_...` on every protected endpoint, resolving it to its owner, and SHALL update `lastUsedAt`.

#### Scenario: Request with a valid key
- **WHEN** a client calls a protected endpoint with a valid key
- **THEN** the request runs as the key's owner

#### Scenario: Revoked key
- **WHEN** a client uses a revoked key
- **THEN** the system responds 401 with code `UNAUTHORIZED`

### Requirement: API key revocation and ownership
The system SHALL let a user revoke only their own keys.

#### Scenario: Revoke own key
- **WHEN** a user sends `DELETE /api/v1/api-keys/:id` for their key
- **THEN** the system responds 204

#### Scenario: Another user's key
- **WHEN** a user tries to delete a key owned by someone else
- **THEN** the system responds 404 with code `NOT_FOUND`
