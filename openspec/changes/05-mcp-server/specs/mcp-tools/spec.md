## ADDED Requirements

### Requirement: MCP endpoint and authentication
The system SHALL serve MCP over streamable HTTP at `/mcp` (port 3100) and MUST reject requests without `Authorization: Bearer <token>`, where the token is an OAuth access token (primary) or a personal API key (advanced).

#### Scenario: Missing token starts OAuth discovery
- **WHEN** a client calls `/mcp` without a bearer token
- **THEN** the system responds 401 with a `WWW-Authenticate: Bearer resource_metadata="<PUBLIC_URL>/.well-known/oauth-protected-resource"` header and executes no tool

#### Scenario: Zero-configuration connection
- **WHEN** a user adds only the MCP URL to an OAuth-capable client
- **THEN** the client can complete the OAuth flow of the `oauth-authorization` capability and call tools without any manual key

#### Scenario: Per-user identity
- **WHEN** two clients call with different tokens
- **THEN** each tool call runs as the user who authorized the token sent in that same call

#### Scenario: Expired token
- **WHEN** the API answers 401 to a forwarded token
- **THEN** the MCP answers 401 with the same `WWW-Authenticate` header so the client refreshes or re-authorizes

### Requirement: Token forwarding without shared credentials
The system MUST forward the caller's bearer token to the Taskory API and MUST NOT hold or use any credential of its own.

#### Scenario: Invalid token
- **WHEN** the API rejects the token
- **THEN** the MCP answers 401 as described above instead of a tool result

### Requirement: log_activity
The system SHALL provide `log_activity` with `title` required and `date`, `description`, `referenceUrls`, `tags`, `project` optional; `date` defaults to today.

#### Scenario: Log with defaults
- **WHEN** an agent calls `log_activity` with only `title`
- **THEN** an activity is created for today and the created activity is returned

### Requirement: list_activities
The system SHALL provide `list_activities` with optional `from`, `to`, `project`, `tag`, `q`, `limit`.

#### Scenario: Filter by range
- **WHEN** an agent lists with `from` and `to`
- **THEN** only activities in that range are returned

### Requirement: update_activity and delete_activity
The system SHALL provide `update_activity` (id plus partial fields) and `delete_activity` (id).

#### Scenario: Unknown id
- **WHEN** the id does not exist or belongs to another user
- **THEN** the tool returns an error result stating the activity was not found

### Requirement: generate_report
The system SHALL provide `generate_report` with `from`, `to` required and `project`, `language`, `provider`, `model` optional.

#### Scenario: Report returned
- **WHEN** an agent calls `generate_report` for a range with activities
- **THEN** the tool returns the Markdown report

### Requirement: Tool descriptions guide the agent
Each tool SHALL have a description stating when the agent should use it and typed, documented parameters.

#### Scenario: Tool discovery
- **WHEN** a client lists tools
- **THEN** each has a description and a parameter schema

### Requirement: Asynchronous reports
When the API answers 202 to a report request, `generate_report` SHALL return the report `id`, `status` and `progress` instead of waiting indefinitely, and the system SHALL provide `get_report` (id) that returns the current status, progress and, when completed, the Markdown.

#### Scenario: Large report
- **WHEN** an agent calls `generate_report` for a range with more than 100 activities
- **THEN** the tool returns the report id and progress, and tells the agent to call `get_report` later

#### Scenario: Completed report
- **WHEN** an agent calls `get_report` for a completed report
- **THEN** the tool returns the Markdown report

### Requirement: Token validation on every request
The system SHALL validate the bearer token against the Taskory API on every MCP request and MUST NOT cache validation results, so that a revoked token is rejected with the 401 discovery challenge on the very next request.

#### Scenario: Revoked token
- **WHEN** a token is revoked and the client sends the next MCP request
- **THEN** the system responds 401 with the `WWW-Authenticate` challenge

### Requirement: Cross-origin preflight
The system SHALL answer `OPTIONS /mcp` preflight requests without requiring a token and SHALL expose the `WWW-Authenticate` and MCP protocol headers to browser clients.

#### Scenario: Browser preflight
- **WHEN** a browser client sends `OPTIONS /mcp` with an `Origin` and `Access-Control-Request-Method`
- **THEN** the system responds 204 with the allowed methods and headers (including `Authorization` and `Content-Type`) and does not execute any tool

### Requirement: Paginated activity listing
`list_activities` SHALL accept an optional `page` and return `total`, `page` and `limit` so an agent can retrieve every matching record.

#### Scenario: More results than one page
- **WHEN** the API reports a `total` larger than the returned items
- **THEN** the tool result states that more pages exist and how to request the next one

### Requirement: User-local default date
`log_activity` SHALL accept an optional IANA `timezone` and, when `date` is omitted, SHALL use today's date in that timezone, falling back to the server's timezone when none is given.

#### Scenario: Date near midnight
- **WHEN** it is already the next day on the server but still the previous day in the given `timezone`
- **THEN** the activity is logged with the date in the given timezone

### Requirement: Upstream failures are distinguishable
The system SHALL report network failures, timeouts and API 5xx responses as a stable retryable error (`UPSTREAM_UNAVAILABLE`), distinct from client-correctable API errors, which keep their API code.

#### Scenario: API unreachable
- **WHEN** the Taskory API does not answer within the timeout
- **THEN** the tool result is an error with code `UPSTREAM_UNAVAILABLE` and a message saying it can be retried

#### Scenario: API unreachable before dispatch
- **WHEN** network failure, timeout, or an API 5xx occurs while validating the bearer token before MCP dispatch
- **THEN** the HTTP response is 503 JSON with `Retry-After: 5` and a JSON-RPC `UPSTREAM_UNAVAILABLE` error; an API 401 still receives the discovery challenge, API 429 maps to `RATE_LIMITED` with its `Retry-After`, and other API 4xx map to `UPSTREAM_REJECTED` without leaking upstream response data
