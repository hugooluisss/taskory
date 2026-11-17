## MODIFIED Requirements

### Requirement: Report size limit
The system SHALL generate reports of up to 3000 matching activities (single pass up to 100, chunked beyond that as defined in `chunked-report-generation`) and SHALL refuse larger ones before calling the provider.

#### Scenario: Range too large
- **WHEN** the selected range, project and tags match more than 3000 activities
- **THEN** the system responds 422 with code `RANGE_TOO_LARGE` and does not call the provider

#### Scenario: Tag filter
- **WHEN** `tags` is provided
- **THEN** only activities having at least one of those tags are included
