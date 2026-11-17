## ADDED Requirements

### Requirement: Report generation
The system SHALL generate a Markdown report from the caller's activities in `[from, to]`, optionally filtered by `project` and `tags`, via `POST /api/v1/reports`, returning `markdown`, `provider`, `model` and `activityCount`.

#### Scenario: Successful report
- **WHEN** an authenticated user requests a report for a range containing activities
- **THEN** the system responds 200 with the Markdown and the number of activities used

#### Scenario: Only own activities
- **WHEN** another user has activities in the same range
- **THEN** they are never included in the report

#### Scenario: No activities
- **WHEN** the range contains no activities
- **THEN** the system responds 422 with code `NO_ACTIVITIES` and does not call the provider

### Requirement: Report language and style
The report SHALL be written in the requested `language` (`es` or `en`) and `style` (`summary` or `detailed`), grouped by day and project.

#### Scenario: Spanish detailed report
- **WHEN** `language` is `es` and `style` is `detailed`
- **THEN** the instructions sent to the provider request Spanish output with per-activity detail

### Requirement: Provider failure handling
The system SHALL translate provider failures into a controlled error.

#### Scenario: Provider down
- **WHEN** the selected provider fails or times out
- **THEN** the system responds 502 with code `LLM_UNAVAILABLE`

#### Scenario: Unknown provider
- **WHEN** the request names a provider that does not exist
- **THEN** the system responds 400 with code `UNKNOWN_PROVIDER`

### Requirement: Input validation
The system SHALL reject invalid ranges.

#### Scenario: Inverted range
- **WHEN** `from` is after `to`
- **THEN** the system responds 400 with code `VALIDATION_ERROR`

### Requirement: Report size limit
The system SHALL refuse to generate a report from more than 300 activities, to stay within model context limits.

#### Scenario: Range too large
- **WHEN** the selected range, project and tags match more than 300 activities
- **THEN** the system responds 422 with code `RANGE_TOO_LARGE` and does not call the provider

#### Scenario: Tag filter
- **WHEN** `tags` is provided
- **THEN** only activities having at least one of those tags are included
