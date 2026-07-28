`useRuns(projectId)` — the selected project's runs (live + archived) polled every 2s via `onRuns`, returning `{runs, reload, loaded}`.

## TLDR

- Owned by the shell (+Page) so the Runs rail and the main pane read one list: the rail renders rows, the pane routes the selected run to live view or replay by status.
- `reload` is `usePolled`'s shared guarded one — it used to be a second, unguarded copy of the read, so a run started just before a project switch could write the old project's runs.
- `loaded` lets the shell tell a session that is gone from one it has not read yet (#784): a bookmarked link must not flash "gone" while the first read is still out.
