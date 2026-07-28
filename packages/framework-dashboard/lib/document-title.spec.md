Composes and syncs the browser-tab title from the needs-you count and the selected project (#695/U3), e.g. `(2) gemstack — The Framework`, so the tab alone says which of several open dashboards needs you.

## TLDR

- `frameworkTitle(needsYou, projectName?)` — pure composer: `(N) ` prefix only when the count is > 0, `project — ` scope only when a project is selected, always ending in `The Framework`.
- `useDocumentTitle(...)` — client-only effect writing that to `document.title` (guards `typeof document === 'undefined'`).
