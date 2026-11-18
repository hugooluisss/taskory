# Project catalog

Today an activity carries a free-text `project`, which produces duplicates and variants (`SIGEI` vs `sigei`). Introduce a per-user catalog of projects and make activities reference it.

## Scope

API (new `projects` module, activities reference `projectId`, reports filter by project ids), MCP (`log_activity` keeps accepting a project name and resolves it; new `list_projects`), web (project selector with "create new", management page), data migration of existing values. The report pipeline (change 11) is out of scope.
