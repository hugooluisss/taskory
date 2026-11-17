# Web design brief (apps/web)

Audience: people who are NOT technical. They log what they did at work and later ask for a report. Plain words, no jargon (say "Connect your assistant", not "OAuth" or "MCP"; API keys live under "Advanced").

## Principles
- Logging an activity takes at most two actions: a quick-add bar on the main page (title + Enter, date defaults to today, everything else optional behind "More details").
- Every screen has one obvious primary action. Destructive actions (delete, disconnect, revoke) use an accessible confirmation dialog (native `<dialog>` element, focus trapped, Escape closes, default focus on the safe button) and never `window.confirm`.
- Always show state: loading skeleton or spinner, friendly empty state with a next step, translated error with a retry when it makes sense, success feedback that does not block (toast/inline).
- Forms: inline validation on blur and on submit, errors next to the field and announced with `aria-live`, never lose typed data on an error.
- Bilingual es/en everywhere (Spanish first for es users); dates and numbers formatted with the active locale.

## Look and feel
- Calm, modern, friendly. Light theme only. Generous white space, 8px spacing scale, 12px radius cards with a soft shadow, one accent colour.
- Design tokens as CSS custom properties in `src/styles/tokens.css`: `--color-bg #f7f8fb`, `--color-surface #ffffff`, `--color-text #1b2333`, `--color-muted #5d6779`, `--color-accent #3b5bdb` (hover `#2f4ac0`), `--color-danger #c92a2a`, `--color-success #2b8a3e`, `--color-border #dde2ec`; focus ring 3px `rgba(59,91,219,.35)`.
- Typography: system UI font stack (no external fonts), 16px base, headings 600 weight, line-height 1.5.
- Layout: top bar with the app name, main nav (Activities, Reports, Settings) and the language switcher; content max-width 960px centred; on phones the nav collapses to a bottom or menu pattern; everything usable from 360px width.
- Components to build once in `src/app/shared/`: button (primary/secondary/danger/ghost), text field + label + error, textarea, select, chips input (tags, URLs), confirm dialog, toast, empty state, spinner/skeleton, page header, pagination.

## Accessibility (non-negotiable)
- WCAG AA contrast, visible focus, full keyboard operation, correct landmarks (`header`, `nav`, `main`), labels bound to inputs, `lang` attribute follows the active language, `prefers-reduced-motion` respected, no information conveyed by colour alone.

## Key screens
1. Login / Register (single card, switch link, language switcher visible before login).
2. Activities: quick-add bar, filters (collapsed on phones), list grouped by day with title, project chip, tags and links, edit in a side panel or dialog, pagination.
3. Reports: range picker with presets (this week, last week, this month, last month), project, language, style; "Generate"; progress bar for long reports with a plain sentence ("Reading your activities, part 3 of 11"); result rendered as formatted Markdown with Copy; retry and delete for failed or old reports.
4. Settings: profile (name, language); "Connect your assistant" card with the server address, copy button and 3 plain steps; connected assistants list with Disconnect; Advanced (collapsed): personal access keys.
5. Consent (`/oauth/consent?request=<id>`): clear question "Allow <name> to access your Taskory?", what is granted (full access to your activities), the client id and the full redirect destination, the name labelled "not verified", Allow / Deny buttons, never frameable.
