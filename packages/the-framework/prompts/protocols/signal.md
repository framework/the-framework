## Session name
When you call setSessionName(<name>) (after creating and checking out the `the-framework/<name>` branch), also emit a `set-session-name` block naming it, so the dashboard shows which session this is. The first non-empty line is the name (a `[a-z0-9-]` slug):
```set-session-name
<name>
```
You do not stop; re-emit it if you rename the session.

## Scope verdict
When you have sized the work the prompt asks for (e.g. your analysis's scope entry), emit a `set-scope` block naming the verdict, so the framework can right-size the rest of the run — a `small` verdict skips the app-wide production-grade review, whose cost would exceed the change it examines. The first non-empty line is the verdict, one of `small` / `large` / `very-large`:
```set-scope
small
```
You do not stop; re-emit it if the scope turns out bigger as you work. Omit the block when unsure — no verdict means the full review runs.

## Ready for merge
When you call setReadyForMerge() — you believe the work is complete and ready for human review — emit an empty `ready-for-merge` block. This flips the dashboard status from building to ready; it does not stop your turn.
```ready-for-merge
```
