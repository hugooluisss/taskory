## MODIFIED Requirements

### Requirement: Activity management
The web client SHALL show the activities list and its filters as the only activities page content. The page SHALL let users create, edit, and delete activities, with required date and title, several reference URLs, tags, and project suggestions. Creating and editing SHALL use the same accessible native modal dialog opened from the page header's “Add activity” button. The dialog SHALL support keyboard focus containment and return focus to its opener, close on Escape, preserve values after save errors, and support at least three reference URLs. The old inline quick-add SHALL NOT be shown.

#### Scenario: Create with three reference URLs
- **WHEN** the user creates an activity in the modal with three reference URLs
- **THEN** all three URLs are saved and the activity appears in the list

#### Scenario: Edit activity in the shared modal
- **WHEN** the user chooses to edit an activity
- **THEN** the same modal opens populated with that activity's values

#### Scenario: Modal keyboard behavior
- **WHEN** the activity modal is open
- **THEN** focus remains within it, Escape closes it, and focus returns to the opening control

#### Scenario: Save error retains form values
- **WHEN** saving an activity fails
- **THEN** a translated error is shown and the modal retains entered values

#### Scenario: Delete confirmation
- **WHEN** the user clicks delete
- **THEN** a confirmation is requested and nothing is deleted if it is declined

### Requirement: Activity filters
The activities page SHALL keep title search visible at all viewport sizes. A “More filters” control SHALL toggle the date range, project, and tag filters and expose its state with `aria-expanded` and `aria-controls`. When filters are active, the page SHALL show an active-filter count and a clear action.

#### Scenario: Expand and collapse additional filters
- **WHEN** the user toggles “More filters”
- **THEN** date range, project, and tag controls are revealed or hidden and the expanded state is announced

#### Scenario: Clear active filters
- **WHEN** the user clears active filters
- **THEN** the active count resets and the unfiltered activity list is loaded

## ADDED Requirements

### Requirement: Responsive light component system
The web client SHALL use Tailwind CSS and DaisyUI for consistent shared forms and components, with a single light theme, responsive layout, visible keyboard focus, and WCAG AA text contrast. All visible new text SHALL be translated in English and Spanish.

#### Scenario: Responsive app shell
- **WHEN** the app is viewed at phone or desktop width
- **THEN** its brand, navigation, language switcher, and logout remain usable

#### Scenario: Accessible light theme
- **WHEN** a user views shared controls
- **THEN** controls use the light theme with visible focus and readable AA contrast
