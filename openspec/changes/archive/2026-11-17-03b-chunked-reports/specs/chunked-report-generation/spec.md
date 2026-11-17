## ADDED Requirements

### Requirement: Single pass for small reports
The system SHALL generate a report in a single provider pass when the selected activities are 100 or fewer, responding 200 with the report as in `report-generation`.

#### Scenario: Up to 100 activities
- **WHEN** a user requests a report matching 100 activities
- **THEN** the system responds 200 with `markdown`, `provider`, `model` and `activityCount`, and no job is created

### Requirement: Chunked generation for large reports
The system SHALL split reports of more than 100 activities into chunks of 100 activities, ordered by date ascending, and evaluate each chunk with the provider to select the high-impact activities and write a short chunk summary.

#### Scenario: 250 activities
- **WHEN** a user requests a report matching 250 activities
- **THEN** the system responds 202 with `id`, `status` `queued` and `progress.total` 3, and processes chunks of 100, 100 and 50 activities in date order

#### Scenario: Chunk evaluation output
- **WHEN** a chunk is evaluated
- **THEN** the provider output is validated as structured data with a `summary` and a list of `highlights`, each referencing an activity id of that chunk, with an `impact` of `high` or `medium` and a short `reason`

#### Scenario: Invalid provider output
- **WHEN** the provider returns output that is not valid structured data or references an unknown activity id
- **THEN** the chunk evaluation is retried up to 2 times and, if still invalid, the job fails

### Requirement: Report memory
The system SHALL store the result of each evaluated chunk (date span, activity count, summary, highlights) as the memory of the report, owned by the report's user.

#### Scenario: Memory accumulates
- **WHEN** a chunk finishes
- **THEN** its memory entry is persisted and `progress.done` increases by one

#### Scenario: Memory survives a restart
- **WHEN** the server restarts while a job is running
- **THEN** the job is marked `failed` with reason `INTERRUPTED` and keeps the memory of already finished chunks

### Requirement: Final report from memory
The system SHALL write the final report from the report memory once all chunks are finished, in the requested language and style, using only the memory and deterministic totals computed by the system (activities per project and per day), never the raw activities.

#### Scenario: Completion
- **WHEN** all chunks are evaluated
- **THEN** the job status becomes `completed` and `GET /reports/:id` returns `markdown`, `provider`, `model` and `activityCount`

#### Scenario: Memory too large
- **WHEN** the memory has more than 100 highlights
- **THEN** it is consolidated in groups before the final writing so that the final prompt stays within the limit

### Requirement: Report job status
The system SHALL expose `GET /api/v1/reports/:id` returning `id`, `status` (`queued`, `running`, `completed` or `failed`), `progress` (`done`, `total`), `createdAt`, `finishedAt`, and, depending on status, `markdown` or `error` (`code`, `chunk`).

#### Scenario: Running job
- **WHEN** a user polls a running job
- **THEN** the response has `status` `running` and a `progress.done` between 0 and `progress.total`

#### Scenario: Foreign job
- **WHEN** a user requests a job owned by another user
- **THEN** the system responds 404 with code `NOT_FOUND`

#### Scenario: Failed job
- **WHEN** a chunk fails after its retries
- **THEN** the job status is `failed`, `error.code` is `LLM_UNAVAILABLE` or `INVALID_LLM_OUTPUT` and `error.chunk` is the failing chunk index

### Requirement: Retry
The system SHALL let the owner resume a failed job with `POST /api/v1/reports/:id/retry`, continuing from the first incomplete chunk and reusing the stored memory.

#### Scenario: Resume
- **WHEN** the owner retries a failed job that finished 4 of 7 chunks
- **THEN** the system responds 202, evaluates only chunks 5 to 7 and the final report contains the memory of all 7

#### Scenario: Retry of a non-failed job
- **WHEN** the job is queued, running or completed
- **THEN** the system responds 409 with code `REPORT_NOT_RETRYABLE`

### Requirement: Concurrency limits
The system SHALL allow one active (`queued` or `running`) chunked job per user and at most 2 running jobs globally; additional jobs wait queued.

#### Scenario: Second job of the same user
- **WHEN** a user requests a chunked report while another of theirs is active
- **THEN** the system responds 409 with code `REPORT_IN_PROGRESS` and the id of the active job

### Requirement: Delete a report
The system SHALL let the owner delete a job and its memory with `DELETE /api/v1/reports/:id`, cancelling it if it is active.

#### Scenario: Delete
- **WHEN** the owner deletes a job
- **THEN** the system responds 204, no further provider calls are made for it and its memory is removed

### Requirement: Retention
The system SHALL delete finished jobs and their memory after 30 days.

#### Scenario: Expired report
- **WHEN** a job finished more than 30 days ago
- **THEN** it is no longer retrievable and answers 404
