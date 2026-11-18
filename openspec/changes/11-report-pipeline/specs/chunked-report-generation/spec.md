## ADDED Requirements

### Requirement: Provider-aware consolidation budget
The report pipeline SHALL apply a configurable provider-aware character budget to intermediate consolidation prompts and the final report prompt, and SHALL consolidate memory only when it exceeds the applicable prompt budget.

#### Scenario: DeepSeek memory fits its configured capacity
- **WHEN** a DeepSeek report's complete memory and final prompt fit the DeepSeek consolidation budget
- **THEN** the pipeline skips consolidation and sends the memory directly to final report generation

#### Scenario: Memory exceeds the applicable budget
- **WHEN** report memory exceeds the configured provider budget
- **THEN** the pipeline consolidates memory in bounded groups until the final prompt fits or the existing consolidation limit is reached
