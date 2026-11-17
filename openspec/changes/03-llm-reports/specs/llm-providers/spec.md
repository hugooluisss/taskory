## ADDED Requirements

### Requirement: Provider abstraction
The system SHALL support multiple LLM providers behind one common contract, so that adding a provider requires one new adapter and one registration, without changing report logic.

#### Scenario: Ollama provider
- **WHEN** the provider `ollama` is selected
- **THEN** the system generates text through the Ollama server configured by `OLLAMA_BASE_URL`

#### Scenario: DeepSeek provider
- **WHEN** the provider `deepseek` is selected and `DEEPSEEK_API_KEY` is set
- **THEN** the system generates text through the DeepSeek API

### Requirement: Provider availability
The system SHALL report each provider's `id`, `defaultModel` and whether it is currently available via `GET /api/v1/reports/providers`.

#### Scenario: Unreachable provider
- **WHEN** a provider cannot be reached or lacks credentials
- **THEN** it is listed with `available: false` and the request still succeeds

### Requirement: Defaults
The system SHALL use `DEFAULT_LLM_PROVIDER` and `DEFAULT_LLM_MODEL` when the request omits them.

#### Scenario: No provider in request
- **WHEN** a report is requested without `provider`
- **THEN** the configured default provider is used and returned in the response
