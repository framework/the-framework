The Overview's Agents card (#1139): the sessions working right now, each row clickable straight into its session.

## TLDR

- Renders `ActiveRun[]` rows: bullet, one-liner label, project name, and an age ("22s ago") with the exact moment on hover.
- Clicking a row calls `onSelectRun(projectId, runId)` — project AND run, never just the project launcher (the #1189 regression).
- Distinguishes `loading` from empty: the card polls, so pre-first-read must not read as "No agents working right now."
- Row label falls back through `intent → sessionName → scope → projectName` (`activeLabel`) — `ActiveRun` carries no branch or start time to fall back to.

## Decisions

- The Recent column the card launched with is gone: finished sessions already live in the sidebar's session list.
- Its own file rather than inline in `DashboardPage` (unlike other Overview cards): the open-the-session click is the behavior #1189 protects, and `DashboardPage` has no test file to pin it.
- No tooltip on the row itself: it would sit over the age tooltip (#1149).
