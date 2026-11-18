## ADDED Requirements

### Requirement: Project catalog per user
The system SHALL keep a catalog of projects per user, with names unique per user ignoring case and accents.

#### Scenario: Duplicate name
- **WHEN** a user creates a project whose name differs only by case from an existing one
- **THEN** the system answers 409 and creates nothing

### Requirement: Project management
The system SHALL expose CRUD under `/api/v1/projects`, scoped to the authenticated user; names are trimmed, non-empty and at most 100 characters.

#### Scenario: Rename propagates
- **WHEN** a project is renamed
- **THEN** every activity of that project reports the new name

#### Scenario: Delete with activities
- **WHEN** a user deletes a project that has activities
- **THEN** the system answers 409 and the project can only be archived

#### Scenario: Delete empty project
- **WHEN** a project without activities is deleted
- **THEN** it is removed

#### Scenario: Other user's project
- **WHEN** a user references a project id owned by someone else
- **THEN** the system answers 404

### Requirement: Activities reference projects
Activities SHALL reference zero or more projects by `projectIds` and filter lists by `projectIds` (any match).

#### Scenario: Log with several projects
- **WHEN** an activity is created with two valid `projectIds`
- **THEN** it is returned with `projects: [{id, name}, ...]` and appears when filtering by either project

### Requirement: Reports by project ids
Report generation SHALL select activities by `projectIds`.

#### Scenario: Several projects
- **WHEN** a report is requested for two project ids
- **THEN** only activities linked to any of them are included, each once

### Requirement: MCP resolves project names
`log_activity` SHALL find or create each project (`projects` names, or the single `project` alias) by name ignoring case, and `list_projects` SHALL list the user's non-archived projects.

#### Scenario: Case variant
- **WHEN** the agent logs an activity with project `sigei` and `SIGEI` exists
- **THEN** the activity is attached to `SIGEI` and no project is created

### Requirement: Data migration
The migration SHALL convert existing text projects into catalog projects without losing activities.

#### Scenario: Merge variants
- **WHEN** activities exist with `SIGEI` and `sigei`
- **THEN** one project `SIGEI` exists and both activities reference it

### Requirement: Web catalog
The web app SHALL offer a project selector with "create new" in the activity forms and report form, and a page to rename, archive and delete projects.

#### Scenario: Create from selector
- **WHEN** the user types a new name in the selector and confirms
- **THEN** the project is created and selected
