## ADDED Requirements

### Requirement: Report project selection
Reports SHALL accept an optional list of up to 20 project names. Each name is trimmed, non-empty, and no longer than the activity project limit (100 characters); duplicates are removed. An activity matches when its project is any selected project. An omitted or empty list includes all projects. Invalid lists return 400 `VALIDATION_ERROR`.

#### Scenario: One project
- **WHEN** a report is requested with one project
- **THEN** only activities assigned to that project are included

#### Scenario: Several projects
- **WHEN** a report is requested with several projects
- **THEN** activities assigned to any selected project are included and the generated report groups by project

#### Scenario: None means all
- **WHEN** a report is requested with projects omitted or an empty list
- **THEN** activities from all projects are included

#### Scenario: Too many or invalid projects
- **WHEN** a request contains more than 20 projects, an empty/whitespace name, or a name longer than 100 characters after trimming
- **THEN** the API responds 400 with `VALIDATION_ERROR`

### Requirement: MCP report project selection
The MCP `generate_report` tool SHALL accept an optional array of up to 20 project names and forward it to the API.

#### Scenario: MCP tool
- **WHEN** a client calls `generate_report` with multiple projects
- **THEN** the MCP forwards the project list and returns the API report result
