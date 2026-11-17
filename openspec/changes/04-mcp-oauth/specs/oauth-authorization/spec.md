## ADDED Requirements

### Requirement: Discovery metadata
The system SHALL publish OAuth authorization server metadata at `/.well-known/oauth-authorization-server` and protected resource metadata at `/.well-known/oauth-protected-resource`, both derived from `PUBLIC_URL`.

#### Scenario: Client discovers the server
- **WHEN** a client requests the authorization server metadata
- **THEN** the response lists `issuer`, `authorization_endpoint`, `token_endpoint`, `registration_endpoint`, `revocation_endpoint`, `response_types_supported` `["code"]`, `grant_types_supported` `["authorization_code","refresh_token"]` and `code_challenge_methods_supported` `["S256"]`

#### Scenario: Resource points to its authorization server
- **WHEN** a client requests the protected resource metadata of the MCP resource
- **THEN** it names the MCP URL as `resource` and the issuer in `authorization_servers`

### Requirement: Dynamic client registration
The system SHALL let public clients register via `POST /oauth/register` with `client_name` and `redirect_uris`, returning a `client_id`.

#### Scenario: Register a client
- **WHEN** a client posts a valid name and redirect URIs
- **THEN** the system responds 201 with `client_id` and the registered data

#### Scenario: Unsafe redirect URI
- **WHEN** a redirect URI is neither `https` nor an `http` loopback address (`localhost`, `127.0.0.1`, `[::1]`) nor a custom scheme without wildcards
- **THEN** the system responds 400 with `invalid_redirect_uri`

### Requirement: Authorization with PKCE
The system SHALL support the authorization code flow and MUST require a PKCE `code_challenge` with method `S256`; it MUST match `redirect_uri` exactly against the registered values.

#### Scenario: Missing PKCE
- **WHEN** an authorization request has no `code_challenge`
- **THEN** the request is rejected with `invalid_request` and no code is issued

#### Scenario: Redirect URI mismatch
- **WHEN** `redirect_uri` is not one of the client's registered values
- **THEN** the system shows an error and MUST NOT redirect to the supplied URI

#### Scenario: User not logged in
- **WHEN** an unauthenticated user reaches the authorization step
- **THEN** they log in first and then return to the consent screen without losing the request

### Requirement: User consent
The system SHALL show the client name and require explicit approval by the authenticated user before issuing an authorization code, and SHALL return the user to the client with `code` and the original `state`.

#### Scenario: Approve
- **WHEN** the user approves
- **THEN** the system redirects to `redirect_uri` with a single-use `code` valid for at most 10 minutes and the same `state`

#### Scenario: Deny
- **WHEN** the user denies
- **THEN** the system redirects with `error=access_denied` and the same `state`

### Requirement: Token issuance
The system SHALL exchange a valid code plus `code_verifier` at `POST /oauth/token` for an opaque access token (1 hour) and a refresh token (30 days), and MUST reject reused, expired or mismatched codes.

#### Scenario: Valid exchange
- **WHEN** the code, verifier, client and redirect URI match
- **THEN** the system responds 200 with `access_token`, `refresh_token`, `token_type` `Bearer` and `expires_in`

#### Scenario: Code reuse
- **WHEN** a code is presented a second time
- **THEN** the system responds 400 `invalid_grant` and revokes the tokens issued from it

#### Scenario: Wrong verifier
- **WHEN** the `code_verifier` does not match the challenge
- **THEN** the system responds 400 `invalid_grant`

### Requirement: Refresh rotation
The system SHALL rotate the refresh token on every use and treat reuse of a rotated token as compromise.

#### Scenario: Refresh
- **WHEN** a client sends a valid refresh token
- **THEN** it receives a new access and refresh token and the old refresh token stops working

#### Scenario: Reused refresh token
- **WHEN** an already rotated refresh token is presented
- **THEN** the system responds 400 `invalid_grant` and revokes that authorization

### Requirement: Token storage
The system MUST store authorization codes, access tokens and refresh tokens only as hashes.

#### Scenario: Database leak
- **WHEN** the database content is inspected
- **THEN** no usable token or code can be recovered

### Requirement: OAuth tokens authenticate API calls
The system SHALL accept a valid OAuth access token as `Authorization: Bearer <token>` on protected endpoints, running the request as the user who approved it.

#### Scenario: Valid token
- **WHEN** a client calls a protected endpoint with a valid access token
- **THEN** the request runs as the approving user

#### Scenario: Expired or revoked token
- **WHEN** the token is expired or revoked
- **THEN** the system responds 401 with code `UNAUTHORIZED`

### Requirement: Revocation
The system SHALL support `POST /oauth/revoke` for access and refresh tokens.

#### Scenario: Revoke refresh token
- **WHEN** a client revokes its refresh token
- **THEN** the authorization can no longer be refreshed

### Requirement: Abuse limits
The system SHALL rate limit `/oauth/register`, `/oauth/token` and the approval endpoint.

#### Scenario: Flood
- **WHEN** a client exceeds the limit
- **THEN** the system responds 429

### Requirement: Resource binding
The system SHALL accept the RFC 8707 `resource` parameter on authorization and token requests, bind each authorization to the single protected resource `<PUBLIC_URL><MCP_PATH>`, and refuse any other value with `invalid_target`. When `resource` is omitted, the system SHALL default to that resource. Access tokens SHALL be accepted by the API only when their authorization is bound to that resource, and refresh SHALL NOT change the bound resource.

#### Scenario: Wrong resource
- **WHEN** an authorization or token request names a `resource` other than `<PUBLIC_URL><MCP_PATH>`
- **THEN** the system answers 400 `invalid_target`

#### Scenario: Resource omitted
- **WHEN** a client omits `resource`
- **THEN** the authorization is bound to `<PUBLIC_URL><MCP_PATH>`

### Requirement: Scope handling
The system SHALL define one scope, `taskory`, that grants full access to the approving user's Taskory data, advertise it as `scopes_supported`, treat an omitted scope as `taskory`, and refuse any other requested scope with `invalid_scope`; the consent data SHALL state the granted access.

#### Scenario: Unsupported scope
- **WHEN** an authorization request asks for a scope other than `taskory`
- **THEN** the client is redirected with `error=invalid_scope` and the original `state`

### Requirement: Code replay revokes the whole grant
When an already used authorization code is presented again, the system SHALL revoke the entire authorization it created, including every access and refresh token issued from it or from its rotations.

#### Scenario: Replay after rotation
- **WHEN** a code is exchanged, the refresh token is rotated, and the same code is presented again
- **THEN** the system answers `invalid_grant` and both the rotated access token and the rotated refresh token stop working

### Requirement: Replay evidence retention
The system SHALL keep used codes and rotated refresh tokens (as hashes) for as long as their authorization is alive, and SHALL purge them only when the authorization is revoked or has no unexpired token left.

#### Scenario: Purge then replay
- **WHEN** the purge job runs while a rotated descendant token is still valid and an old refresh token is then presented
- **THEN** the system answers `invalid_grant` and revokes the whole authorization

### Requirement: Strict consent decision
The decision endpoint SHALL require `approve` to be a JSON boolean and SHALL reject any other type or a missing value with 400 before claiming the request.

#### Scenario: Non-boolean approve
- **WHEN** the body contains `{"approve":"true"}`, a number, null, an array, an object or no `approve`
- **THEN** the system answers 400 `VALIDATION_ERROR` and the request stays decidable

### Requirement: Atomic approval
Claiming the authorization request, creating the authorization and storing the code SHALL happen in one transaction.

#### Scenario: Failure while storing the code
- **WHEN** storing the code fails
- **THEN** nothing is persisted and the request remains decidable

### Requirement: Registration metadata honesty
The registration endpoint SHALL accept only `token_endpoint_auth_method` `none`, `grant_types` within `authorization_code` and `refresh_token`, and `response_types` `code`, SHALL reject anything else with `invalid_client_metadata`, and SHALL return `token_endpoint_auth_method: "none"`. Registered redirect URIs SHALL NOT contain whitespace or control characters.

#### Scenario: Confidential client requested
- **WHEN** a client registers with `token_endpoint_auth_method` `client_secret_basic`
- **THEN** the system answers 400 `invalid_client_metadata`

#### Scenario: Control characters in a redirect URI
- **WHEN** a redirect URI contains CR, LF, tab or any other control character
- **THEN** the system answers 400 `invalid_redirect_uri`

### Requirement: Issuer identification
Every redirectable authorization response (success, denial or error) SHALL carry the `iss` parameter with the configured issuer, and the metadata SHALL advertise `authorization_response_iss_parameter_supported: true`.

#### Scenario: Denial carries the issuer
- **WHEN** the user denies a request
- **THEN** the redirect contains `error=access_denied`, the original `state` and `iss=<PUBLIC_URL>`

### Requirement: Issuer URL validation
In production the configured `PUBLIC_URL` SHALL be an absolute `https` URL without userinfo, path, query or fragment, otherwise the server SHALL refuse to start; `http` is accepted only for loopback hosts outside production.

#### Scenario: Insecure issuer in production
- **WHEN** `NODE_ENV=production` and `PUBLIC_URL` is `http://example.com`
- **THEN** startup fails with a clear error

### Requirement: Revocation endpoint throttling
`/oauth/revoke` SHALL be rate limited like the other OAuth endpoints.

#### Scenario: Revoke flood
- **WHEN** a client exceeds the limit
- **THEN** the system answers 429

### Requirement: Transaction isolation
All multi-write database operations of the OAuth module (and of the report jobs module) SHALL run serialized through one transaction runner for the single database connection, so that overlapping requests cannot release, roll back or commit each other's work.

#### Scenario: Overlapping approvals and exchanges
- **WHEN** an approval fails and rolls back while another approval or a token exchange runs at the same time
- **THEN** the failed operation leaves no rows, and the other operation commits exactly its own rows

### Requirement: Code exchange validates the grant atomically
Consuming an authorization code SHALL succeed only if, in the same atomic conditional write, the code is unused and unexpired, its authorization is not revoked and its authorization is bound to the expected resource.

#### Scenario: Revoked before exchange
- **WHEN** the user disconnects the app after approving and before the client exchanges the code
- **THEN** the exchange answers `invalid_grant` and no token is issued

### Requirement: Absolute grant lifetime
An authorization SHALL stop being refreshable 180 days after its creation regardless of rotation, answering `invalid_grant`, and a grant past that lifetime SHALL be treated as dead for retention and purge.

#### Scenario: Refresh after the absolute lifetime
- **WHEN** a client refreshes an authorization older than 180 days
- **THEN** the system answers `invalid_grant`

### Requirement: Consent shows the full destination
The consent lookup SHALL return the complete registered redirect URI, the `client_id` and the client name (unverified).

#### Scenario: Custom scheme destination
- **WHEN** the consent request belongs to a client with a custom-scheme redirect URI
- **THEN** the response contains the complete URI, not only its scheme

### Requirement: Configurable resource path
The system SHALL read `MCP_PATH` in both the API and MCP server, default it to `/mcp`, and reject values that do not start with `/` or contain a query, fragment, or trailing slash. The API SHALL publish protected resource metadata at `/.well-known/oauth-protected-resource<MCP_PATH>` and keep `/.well-known/oauth-protected-resource` as an alias; the MCP challenge SHALL reference the matching metadata URL.

#### Scenario: Custom resource path
- **WHEN** `MCP_PATH=/taskory-mcp`
- **THEN** the MCP listens at `/taskory-mcp`, metadata names `<PUBLIC_URL>/taskory-mcp`, OAuth accepts that resource and refuses `<PUBLIC_URL>/mcp` with `invalid_target`, and the 401 challenge points to `/.well-known/oauth-protected-resource/taskory-mcp`
