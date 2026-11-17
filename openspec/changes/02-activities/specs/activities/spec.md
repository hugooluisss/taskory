## ADDED Requirements

### Requirement: Activity creation
The system SHALL let an authenticated user create an activity with required `date` (YYYY-MM-DD) and `title` (1-200 chars) and optional `description`, `referenceUrls` (valid URLs, max 20), `tags` (max 20) and `project`.

#### Scenario: Minimal activity
- **WHEN** a user sends `POST /api/v1/activities` with only `date` and `title`
- **THEN** the system responds 201 with the activity, `referenceUrls` and `tags` as empty arrays, and `description` and `project` as null

#### Scenario: Multiple reference URLs
- **WHEN** the request includes several valid `referenceUrls`
- **THEN** all are stored and returned in order

#### Scenario: Missing required field
- **WHEN** `date` or `title` is missing or malformed
- **THEN** the system responds 400 with code `VALIDATION_ERROR`

#### Scenario: Invalid URL
- **WHEN** any `referenceUrls` entry is not a valid URL
- **THEN** the system responds 400 with code `VALIDATION_ERROR`

### Requirement: Tag normalization
The system SHALL trim, lowercase and deduplicate tags.

#### Scenario: Duplicate tags
- **WHEN** tags `["API", "api ", "Bug"]` are submitted
- **THEN** the stored tags are `["api", "bug"]`

### Requirement: Activity listing and filters
The system SHALL list only the caller's activities ordered by `date` descending then `createdAt` descending, paginated, filterable by `from`, `to` (inclusive), `project`, `tag` and `q` (text match on title and description).

#### Scenario: Date range
- **WHEN** a user lists with `from=2026-11-01&to=2026-11-15`
- **THEN** only activities within that inclusive range are returned

#### Scenario: Text search
- **WHEN** a user lists with `q=login`
- **THEN** only activities whose title or description contains it are returned

### Requirement: Activity read, update and delete
The system SHALL let the owner read, partially update and delete an activity.

#### Scenario: Partial update
- **WHEN** the owner PATCHes only `title`
- **THEN** other fields are unchanged and `updatedAt` changes

#### Scenario: Delete
- **WHEN** the owner deletes an activity
- **THEN** the system responds 204 and subsequent reads respond 404

### Requirement: Per-user isolation
The system MUST NOT reveal or modify another user's activities.

#### Scenario: Foreign activity
- **WHEN** a user requests, updates or deletes an activity owned by another user
- **THEN** the system responds 404 with code `NOT_FOUND`

#### Scenario: Listing never leaks
- **WHEN** two users have activities
- **THEN** each user's listing contains only their own

### Requirement: Activity metadata
The system SHALL expose `GET /api/v1/activities/meta` returning the caller's distinct `projects` and `tags`.

#### Scenario: Suggestions
- **WHEN** a user has activities in projects "A" and "B"
- **THEN** `projects` contains exactly "A" and "B"
