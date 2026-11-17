# Design

Use Tailwind CSS v4 through Angular's PostCSS integration and DaisyUI through its Tailwind plugin. Configure DaisyUI with one light theme using the existing blue brand color and accessible foregrounds. Shared controls use DaisyUI classes in external Angular templates while preserving their public inputs, outputs, ARIA behavior, and ControlValueAccessor contracts.

The app shell uses a responsive top navbar. Activities keep the list and filters as their only content; the page header opens the existing create/edit form in a native `<dialog>` with DaisyUI modal styling. The browser provides modal focus containment and Escape handling; closing returns focus to the opener. A failed save leaves the dialog and entered values intact.

The filters keep title search visible and toggle the remaining fields with an explicit `aria-expanded` and `aria-controls`. Active filters are counted and can be cleared. All new copy uses the `activities.` translation namespace in both supported locales.

The shared `app-icon` component renders only the required Heroicons outline paths from a typed name-to-path map, using inline SVG, currentColor, and Tailwind sizing. Icon-only controls retain translated accessible names; visible labels remain alongside their icons.
