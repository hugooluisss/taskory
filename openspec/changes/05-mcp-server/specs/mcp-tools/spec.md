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
