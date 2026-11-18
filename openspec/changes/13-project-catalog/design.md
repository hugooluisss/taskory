## Decisions

- Table `projects`: `id`, `userId` (FK, cascade), `name` (varchar 100, collation `utf8mb4_0900_ai_ci`, unique with `userId` so case/accent variants collide), `archived` boolean, timestamps.
- Many-to-many: join table `activity_projects` (`activityId` FK cascade, `projectId` FK RESTRICT, composite PK); an activity has zero, one or several projects. The text `project` column is dropped by a new migration after copying data.
- Data migration: for each user, create one project per distinct trimmed `project` value (case-insensitive merge, keep the most frequent spelling), then link each activity. The activity whose project is `Mantenimientos de seguridad, SIGEI` is assigned to `SIGEI`.
- Deleting a project with activities is refused (409); the user archives it instead. Archived projects are hidden from selectors and suggestions but keep their activities and remain reportable. Renaming updates every activity at once because links hold the id.
- Activities API accepts `projectIds` (all must belong to the user, deduped) and returns `projects: [{id, name}]`; the list filter `projectIds` matches activities having ANY of them.
- Reports take `projectIds` (replacing the project names array of change 09); an activity linked to several selected projects is counted once.
- MCP `log_activity` accepts `projects` (names) and keeps `project` (single name) as an alias: find-or-create each case-insensitively for the user. New `list_projects` tool returns non-archived projects.
- Architecture follows `docs/agent-rules.md`: controller → service → repository, one file per responsibility.
