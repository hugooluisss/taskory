## ADDED Requirements

### Requirement: Project description
Projects SHALL carry an optional description (max 1000 characters, trimmed) editable through API, MCP and web.

#### Scenario: Save description
- **WHEN** a user creates or updates a project with a description
- **THEN** it is returned in every project response and `null` when empty

#### Scenario: Description too long
- **WHEN** the description exceeds 1000 characters
- **THEN** the system answers 400 `VALIDATION_ERROR`

### Requirement: Descriptions feed the report prompt
The projects involved in a report SHALL be passed to the pipeline with name and description and included, as data, in the chunk-evaluation and final-report prompts.

#### Scenario: Prompt carries project context
- **WHEN** a report covers a project with a description
- **THEN** the prompts sent to the provider contain that name and description inside the delimited data block

#### Scenario: Hostile description
- **WHEN** a description contains instructions or markup delimiters
- **THEN** it stays inside the data block (escaped) and the fixed rules still follow the instruction
