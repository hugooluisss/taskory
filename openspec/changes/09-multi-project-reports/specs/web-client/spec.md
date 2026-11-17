## ADDED Requirements

### Requirement: Report generation
The web client SHALL let the user choose a date range, zero or more projects, language, provider, model and style, generate a report, and show it as formatted Markdown.

#### Scenario: Web multi-select
- **WHEN** the user selects multiple projects and generates a report
- **THEN** the request contains those projects; when no project is selected, the request omits `projects`
