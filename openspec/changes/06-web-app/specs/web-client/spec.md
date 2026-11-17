## ADDED Requirements

### Requirement: Access
The web client SHALL provide registration and login pages, keep the session, and redirect to login when the API answers 401.

#### Scenario: Unauthenticated visit
- **WHEN** a visitor opens a protected page without a session
- **THEN** they are redirected to the login page

#### Scenario: Expired session
- **WHEN** an API call answers 401 outside login/register
- **THEN** the session is cleared and the user is sent to login

#### Scenario: Wrong credentials
- **WHEN** login fails with `INVALID_CREDENTIALS`
- **THEN** a translated error message is shown

### Requirement: Activity management
The web client SHALL list activities with filters (from, to, project, tag, text) and pagination, and let the user create, edit and delete them, with required date and title, several reference URLs, tags and project (with suggestions from metadata).

#### Scenario: Create with several URLs
- **WHEN** the user submits the form with three URLs
- **THEN** the activity is saved with all three and shown in the list

#### Scenario: Delete confirmation
- **WHEN** the user clicks delete
- **THEN** a confirmation is requested and nothing is deleted if it is declined

#### Scenario: Save error
- **WHEN** saving fails
- **THEN** a translated error is shown and the form content is kept

### Requirement: Report generation
The web client SHALL let the user choose date range, project, language, provider, model and style, generate a report and show it as formatted Markdown with a button to copy the Markdown.

#### Scenario: Safe rendering
- **WHEN** the report contains HTML or scripts
- **THEN** they are sanitized and not executed

#### Scenario: No activities
- **WHEN** the API answers `NO_ACTIVITIES`
- **THEN** a translated explanatory message is shown

### Requirement: Settings
The web client SHALL let the user update name and language, and, under an "Advanced" section, create, list and revoke API keys, showing a new key only once with a copy button and instructions to use it from clients without OAuth support.

#### Scenario: New key shown once
- **WHEN** the user creates a key
- **THEN** the full key is shown with copy action and is not retrievable afterwards

#### Scenario: Revoke confirmation
- **WHEN** the user revokes a key
- **THEN** a confirmation is requested first

### Requirement: Agent connection and consent
The web client SHALL provide a consent page at `/oauth/consent` that shows the requesting application's name and redirect domain and lets the logged-in user allow or deny, and a "Connect your agent" section in settings that shows the MCP URL with a copy button and plain-language steps, without requiring the user to create a key.

#### Scenario: Login in the middle of authorization
- **WHEN** an unauthenticated user arrives at the consent page from an agent
- **THEN** they log in or register and are returned to the same consent request

#### Scenario: Approve
- **WHEN** the user clicks Allow
- **THEN** the browser is redirected back to the application with the authorization result

#### Scenario: Deny
- **WHEN** the user clicks Deny
- **THEN** the application is informed of the denial and nothing is authorized

#### Scenario: Expired request
- **WHEN** the consent request no longer exists or expired
- **THEN** a translated message explains it and asks the user to retry from the agent

### Requirement: Connected apps
The web client SHALL list the user's connected applications and let them disconnect each one after confirmation.

#### Scenario: Disconnect
- **WHEN** the user confirms disconnecting an app
- **THEN** it disappears from the list and can no longer access their data

### Requirement: Internationalization
All visible text SHALL exist in Spanish and English and switch at runtime; the user's `language` from the API is the source of truth, and before login the browser language (`es` or `en`, default `en`) is used.

#### Scenario: Switch language
- **WHEN** the user switches language
- **THEN** the interface updates immediately and the preference is saved to the profile

### Requirement: Runtime API configuration
The web client SHALL read the API base URL from runtime configuration, defaulting to `/api/v1`.

#### Scenario: Behind a reverse proxy
- **WHEN** no configuration overrides the URL
- **THEN** requests go to `/api/v1`

### Requirement: Long report progress
When a report is generated in chunks, the web client SHALL show a progress indicator, poll the job until it finishes, and let the user retry a failed job or delete a report.

#### Scenario: Progress
- **WHEN** the API answers 202 to a report request
- **THEN** the page shows `done` of `total` chunks and updates until the job is completed or failed

#### Scenario: Failed job
- **WHEN** the job fails
- **THEN** a translated error with the failing chunk is shown together with a retry button

#### Scenario: Leave and return
- **WHEN** the user reloads the page while a job is active
- **THEN** the page resumes showing that job's progress
