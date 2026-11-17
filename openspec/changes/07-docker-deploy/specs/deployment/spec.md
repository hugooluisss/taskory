## ADDED Requirements

### Requirement: One-command startup
The system SHALL start api, mcp and web with `docker compose up -d --build`, with no manual steps beyond providing environment values.

#### Scenario: Fresh server
- **WHEN** an operator copies `.env.example` to `.env`, sets secrets and runs compose
- **THEN** web, api and mcp are reachable and `GET /api/v1/health` returns 200

### Requirement: Data persistence
The system MUST persist the database in a named volume.

#### Scenario: Restart
- **WHEN** the containers are recreated
- **THEN** users and activities are preserved

### Requirement: Secret handling
The system MUST NOT bake secrets into images or the repository, and MUST refuse to start in production without `JWT_SECRET`.

#### Scenario: Missing secret
- **WHEN** `JWT_SECRET` is unset
- **THEN** the api exits with a clear error

### Requirement: Service wiring
The web container SHALL proxy `/api/v1` to the api, and the mcp container SHALL reach the api through the internal network using `TASKORY_API_URL`.

#### Scenario: Same-origin web
- **WHEN** the browser loads the web app
- **THEN** API calls go to the same origin under `/api/v1`

### Requirement: Public URL and OAuth routing
The deployment SHALL require `PUBLIC_URL` and route `/.well-known/*` and `/oauth/*` to the api, `/mcp` to the mcp container and everything else to the web container, all under the same public origin.

#### Scenario: Discovery through the public origin
- **WHEN** a client requests `<PUBLIC_URL>/.well-known/oauth-authorization-server`
- **THEN** it receives the metadata whose `issuer` equals `PUBLIC_URL`

#### Scenario: Missing public URL
- **WHEN** `PUBLIC_URL` is unset in production
- **THEN** the api exits with a clear error

### Requirement: Optional Ollama
The compose file SHALL offer Ollama as an optional profile and configure `OLLAMA_BASE_URL` accordingly.

#### Scenario: Profile enabled
- **WHEN** the operator enables the `ollama` profile
- **THEN** reports can use the `ollama` provider without extra configuration

### Requirement: Least privilege images
Containers SHALL run as a non-root user.

#### Scenario: Process user
- **WHEN** a container is inspected
- **THEN** its process does not run as root
