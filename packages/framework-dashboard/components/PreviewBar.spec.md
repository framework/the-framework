The on-demand app Serve control (#475): serves the project's (or a session worktree's) dev script or built result daemon-side, surfacing the live URL and a Stop — independent of any agent run.

## TLDR

- State lives daemon-side: mount/project-switch rehydrates a running preview via `onPreviewStatus` and lists servable apps via `onServeTargets`, both addressed with `runId` when present.
- One target → a plain Serve icon button. Multi-package repos (#651) → a split control: the primary serves the daemon's remembered last pick (no explicit id), the caret opens the target picker (label + script per row).
- While serving → a segmented pair: Open (live URL, new tab) joined to Stop; `sendPreview(projectId, targetId?, runId?)` / `sendStopPreview(projectId, runId?)` through `useAction` (busy + error line).
- `runId` serves that session's own worktree (#797): without it, Serve in a session's action bar booted the *project's* checkout — an app built from code the session never wrote. Each session previews independently (dev servers pick their own free ports) while the project home keeps serving the main checkout.
- `inline` renders just the control for the action bar; otherwise a full labelled "Serve" row.

## Facts

- The rehydrate must be run-addressed too, or a reload adopts the project preview's URL as if it were the session's (test-pinned).
- Passing no target id serves the daemon's root/remembered default.
