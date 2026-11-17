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
