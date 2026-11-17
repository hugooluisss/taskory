## ADDED Requirements

### Requirement: User registration
The system SHALL allow anyone to register with email, name and a password of at least 8 characters, and SHALL return a session token and the user profile.

#### Scenario: Successful registration
- **WHEN** a client sends `POST /api/v1/auth/register` with a new email, a name and a valid password
- **THEN** the system responds 201 with a `token` and a `user` containing `id`, `email`, `name` and `language`

#### Scenario: Duplicate email
- **WHEN** a client registers an email that already exists
- **THEN** the system responds 409 with code `EMAIL_TAKEN`

#### Scenario: Weak password
- **WHEN** the password has fewer than 8 characters
- **THEN** the system responds 400 with code `VALIDATION_ERROR`

### Requirement: Password security
The system MUST store passwords only as salted hashes and MUST NOT include passwords or hashes in any response or log.

#### Scenario: Profile never exposes secrets
- **WHEN** any auth endpoint returns a user
- **THEN** the payload contains no password or hash field

### Requirement: User login
The system SHALL authenticate a user by email and password and return a session token.

#### Scenario: Valid credentials
- **WHEN** a client sends correct credentials to `POST /api/v1/auth/login`
- **THEN** the system responds 200 with `token` and `user`

#### Scenario: Invalid credentials
- **WHEN** the email is unknown or the password is wrong
- **THEN** the system responds 401 with code `INVALID_CREDENTIALS` and an identical message in both cases

### Requirement: Authenticated profile
The system SHALL expose the current user via `GET /api/v1/auth/me` and allow updating `name` and `language` (`es` or `en`) via `PATCH /api/v1/auth/me`.

#### Scenario: Read profile
- **WHEN** an authenticated client calls `GET /api/v1/auth/me`
- **THEN** the system responds 200 with the user's `id`, `email`, `name` and `language`

#### Scenario: Missing or invalid token
- **WHEN** a protected endpoint is called without a valid token
- **THEN** the system responds 401 with code `UNAUTHORIZED`

#### Scenario: Unsupported language
- **WHEN** a client PATCHes `language` with a value other than `es` or `en`
- **THEN** the system responds 400 with code `VALIDATION_ERROR`

### Requirement: Authentication rate limiting
The system SHALL limit repeated requests to `/auth/*` per client.

#### Scenario: Too many attempts
- **WHEN** a client exceeds the allowed attempts in the window
- **THEN** the system responds 429 with code `TOO_MANY_REQUESTS`

### Requirement: Health check
The system SHALL expose `GET /api/v1/health` without authentication.

#### Scenario: Service up
- **WHEN** the service is running
- **THEN** the system responds 200 with `{"status":"ok"}`
