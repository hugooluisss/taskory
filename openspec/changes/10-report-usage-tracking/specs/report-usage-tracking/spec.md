# report-usage-tracking Specification

## ADDED Requirements

### Requirement: Server-wide report configuration
The system SHALL use the configured default provider and model for every report and SHALL NOT accept provider or model overrides from report callers. The provider availability endpoint SHALL be removed.

#### Scenario: Configured provider and model
- **WHEN** a report is generated
- **THEN** the configured provider and model are used and returned with the result

#### Scenario: DeepSeek default model
- **WHEN** DeepSeek is the configured provider and no server-wide model override is set
- **THEN** the model `deepseek-flash` is used

#### Scenario: Provider unavailable
- **WHEN** the configured provider is unavailable
- **THEN** the request fails with 502 `LLM_UNAVAILABLE`

### Requirement: Token accounting
Each provider completion SHALL return text and prompt, completion, and total token usage. Missing provider usage SHALL count as zero. A report execution SHALL sum all three usage values from every completion, including evaluation, consolidation, final writing, and retries.

#### Scenario: Split usage available
- **WHEN** provider calls report token usage
- **THEN** prompt, completion, and total tokens are summed across all calls in that execution

#### Scenario: Usage unavailable
- **WHEN** a provider response has no usage data
- **THEN** that call contributes zero tokens

#### Scenario: Retry usage counted
- **WHEN** an LLM call is retried
- **THEN** usage from every attempt is included exactly once

### Requirement: Persist report runs
The system SHALL persist a row for every synchronous or asynchronous report execution, including failed executions, with caller, job, inputs, provider, model, split token usage, cost, activity count, creation time, and terminal status. Cost SHALL be calculated from server-wide `LLM_PRICE_INPUT_PER_MTOK` and `LLM_PRICE_OUTPUT_PER_MTOK` prices. Ollama defaults to zero cost; DeepSeek defaults to USD 0.30 per million input tokens and USD 1.20 per million output tokens. Stored cost SHALL use integer micro-dollars and responses SHALL expose USD as a number.

#### Scenario: Synchronous success
- **WHEN** a synchronous report completes
- **THEN** a completed run is persisted with the final usage total

#### Scenario: Failed run
- **WHEN** report generation fails after consuming tokens
- **THEN** a failed run is persisted with usage consumed so far

#### Scenario: Resume chunked job
- **WHEN** a failed chunked job resumes
- **THEN** usage saved with completed chunks is retained and not counted again

#### Scenario: Provider-specific pricing defaults
- **WHEN** pricing variables are unset
- **THEN** Ollama cost is zero and DeepSeek uses its conservative cache-miss prices of USD 0.30 input and USD 1.20 output per million tokens

#### Scenario: Configured pricing
- **WHEN** server-wide input or output pricing is configured
- **THEN** cost is calculated from prompt and completion tokens at those respective rates

### Requirement: Read report run history
The system SHALL expose `GET /api/v1/reports/runs` as a paginated newest-first list scoped to the authenticated caller.

#### Scenario: Own history
- **WHEN** an authenticated user requests report run history
- **THEN** only that user's runs are returned with pagination metadata

#### Scenario: History ownership isolation
- **WHEN** another user has report runs
- **THEN** those runs are not returned

### Requirement: Report result usage
The synchronous response, completed asynchronous job response, and report run history SHALL include provider, model, promptTokens, completionTokens, totalTokens, and costUsd. The web report result SHALL display provider, model, total tokens, and cost.

#### Scenario: Display usage and cost
- **WHEN** a report completes
- **THEN** the result shows its provider, model, total tokens, and formatted USD cost
