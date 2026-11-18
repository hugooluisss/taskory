## ADDED Requirements

### Requirement: Share link with 30-day validity
Each report SHALL have a share link valid for 30 days from creation or last renewal, built from `WEB_PUBLIC_URL` and an unguessable token stored only as a hash.

#### Scenario: Link returned once
- **WHEN** a report is created
- **THEN** the response contains `shareUrl` and `shareExpiresAt`, and later reads only contain `shareExpiresAt`

#### Scenario: Renew
- **WHEN** the owner renews the link
- **THEN** the previous link stops working and a new URL valid for 30 days is returned

### Requirement: Public shared view
`GET /api/v1/shared/:token` SHALL return, without authentication, the period, language, project names and the included activities, and nothing else about the report or the user.

#### Scenario: Valid link
- **WHEN** the link is valid
- **THEN** the activities of the report snapshot are returned, with `Cache-Control: no-store`

#### Scenario: Expired link
- **WHEN** the link is older than its expiry
- **THEN** the system answers 410 `SHARE_EXPIRED`

#### Scenario: Unknown link or deleted report
- **WHEN** the token is unknown or its report was deleted
- **THEN** the system answers 404

#### Scenario: Flood
- **WHEN** a client exceeds the rate limit
- **THEN** the system answers 429

### Requirement: QR in the report document
The web report page SHALL render the share link as a QR code, include it with the link and its expiry in the print layout, and the public page SHALL list the included activities.

#### Scenario: Print layout
- **WHEN** the user prints the report right after creating it
- **THEN** the printout contains the result, a QR of the share URL and its expiry date

#### Scenario: Open the QR link
- **WHEN** someone opens the link before it expires
- **THEN** they see the read-only list of activities without logging in
