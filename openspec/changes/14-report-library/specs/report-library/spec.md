## ADDED Requirements

### Requirement: Every report is persisted
Every report generation SHALL create a persisted report owned by the user, whether it completes synchronously or through the queue, and reports SHALL NOT be purged by age.

#### Scenario: Synchronous report is stored
- **WHEN** a small report completes synchronously
- **THEN** the response includes its `id` and `GET /reports/:id` returns the same markdown

#### Scenario: No age purge
- **WHEN** a report is older than 30 days
- **THEN** it is still listed and readable by its owner

### Requirement: Report listing
`GET /reports` SHALL list the caller's reports, newest first, paginated, without markdown.

#### Scenario: Isolation
- **WHEN** two users have reports
- **THEN** each only lists and reads their own (other users' ids answer 404)

### Requirement: Regenerate with another prompt
`POST /reports/:id/regenerate` SHALL rerun generation over the report's original activity snapshot with the given style, custom prompt and language, overwriting the stored result and recording a run.

#### Scenario: Regenerate with custom prompt
- **WHEN** the owner regenerates a completed report with style `custom` and a prompt
- **THEN** the same activities are used, the markdown is replaced, and the prompt becomes the user's saved custom prompt

#### Scenario: Regenerate while running
- **WHEN** the report is queued or running
- **THEN** the system answers 409

### Requirement: Report detail page
The web app SHALL show each report as an item in a list and, on opening it, its result, metadata and a prompt panel with Regenerate.

#### Scenario: Create then view
- **WHEN** the user submits the report form
- **THEN** the app navigates to the new report's page, shows progress and then the result

#### Scenario: Edit prompt and regenerate
- **WHEN** the user changes the prompt on the detail page and presses Regenerate
- **THEN** the result is replaced when generation completes
