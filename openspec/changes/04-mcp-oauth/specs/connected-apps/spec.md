## ADDED Requirements

### Requirement: List connected apps
The system SHALL let an authenticated user list the applications they have authorized via `GET /api/v1/connected-apps`, with `id`, `clientName`, `createdAt` and `lastUsedAt`.

#### Scenario: Own apps only
- **WHEN** two users have authorized apps
- **THEN** each user sees only their own

### Requirement: Revoke a connected app
The system SHALL let the user revoke an authorization via `DELETE /api/v1/connected-apps/:id`, invalidating its access and refresh tokens immediately.

#### Scenario: Revoke
- **WHEN** the user deletes a connected app
- **THEN** the system responds 204 and the app's tokens answer 401 from then on

#### Scenario: Another user's app
- **WHEN** a user tries to revoke an authorization of someone else
- **THEN** the system responds 404 with code `NOT_FOUND`
