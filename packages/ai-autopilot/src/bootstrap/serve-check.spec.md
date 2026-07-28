A production-grade check with teeth: a `checklist` step that actually BOOTS the app in the runner session and confirms it serves, turning failures into concrete `{ blockers }` verdicts.

## TLDR

- `serveCheck(session, opts)` returns a `BootstrapSteps['checklist']`: optional install → optional build → `session.start(serve)` → `session.preview({ port, waitMs })` → `fetch(healthPath)` → verdict.
- Blockers name exactly what failed: install/build exit code (+ last 3 stderr lines, ≤300 chars), server exited before serving (+ exit code and log tail), unreachable URL, or a status ≥ `errorStatusFrom`.
- `mergeChecklists(...checks)` composes checklist steps: runs all (in parallel), unions + dedupes blockers, joins notes with ` | ` — used to gate a pass on BOTH the prompt verdict (`loopChecklist`) and a real serve check.

## Problems

- A server that accepts the connection but never answers (wedged SSR, mid-HMR) would hang the pass loop forever — the fetch is bounded with `AbortSignal.timeout(waitMs)` and raced against `proc.exit`, since `proc.exit` never settles for a hung server either.
- A server that crashed on boot must be reported as such, not as a generic fetch failure — the `proc.exit` race arm wins and yields an "exited before serving (code N)" blocker.

## Decisions

- Requires a runner with the `start`/`preview` capabilities (the #137 seam); a runner without them *skips* the check — a passing verdict with a `notes` explanation — rather than blocking forever.
- The server process is always stopped in a `finally`, whatever the verdict.
- Ignores its `LoopPassContext` — the check depends only on the workspace, not the pass.

## Facts

- Defaults: `port` 3000, `waitMs` 15000, `healthPath` `/`, `errorStatusFrom` 500, `commandTimeoutMs` 120000; `install`/`build` are skipped entirely when omitted.
- `onProgress` narrates `install:`/`build:`/`start:`/`fetch … -> status` lines.
