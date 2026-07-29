The daemon-side dashboard backend: the HTTP server that hosts the prerendered SPA + Telefunc RPC surface, the read-only projections it serves (projects, runs, queue, tickets, git/PR state), the handoff and notification machinery, and the relay/bridge endpoints for remote runs and cloud sessions.

## TLDR

- **Server & transport**: `server.ts` (HTTP host, routing, #1051 token guard), `telefunc-serve.ts` (Telefunc mount, `DashboardContext` seam, CSRF guard), `static.ts` + `content-type.ts` + `bundle.ts` (SPA bundle serving/locating), `types.ts` (the Start/Add/Preview RPC vocabulary leaf).
- **Project & run projections**: `projects.ts` (registry → summaries, the `ProjectsProvider` seam per host), `overview.ts` (working-now/recents/hot-tickets), `dashboard.ts` (#471 landing-page rollup), `queue.ts` (cross-project TODO parse), `docs.ts` (surfaced PLAN/TODO docs), `tickets.ts` (the `tickets/` backlog reader), `quota.ts` (usage-panel view).
- **Git/GitHub reads**: `gh.ts` (the one `gh` adapter + PR caches + run-PR attribution), `cache.ts` (stale-while-revalidate read-through cache, #1028), `git-status.ts`, `github.ts` (origin → github.com URL), `file-status.ts`, `file-diff.ts`, `file-read.ts` (confined per-file reads for hover cards).
- **Handoff**: `run-handoff.ts` — what a finished session left on its branch, push/open-PR actions, and the #1102 armed auto-handoff.
- **Notifications**: `keyed-watcher.ts` (baseline-diff poll engine), `interventions.ts` ("needs you": PRs / parked gates / unpushed work), `activity.ts` (started/finished feed), `keys.ts` (pure item identities shared with the browser), `discord-webhook.ts` (the one webhook transport).
- **Remote & bridge**: `relay-endpoints.ts` + `remote-run.ts` (device-to-device run relay, #1067), `browser-proxy.ts` (run's MJPEG browser preview, #813), `bridge-endpoints.ts` + `bridge-store.ts` + `bridge-sessions.ts` (Claude-web extension bridge for cloud-session questions, #1237).
- **Actions**: `open-in-app.ts` (reveal in file manager / open in editor, editor detection).

## Decisions

- Everything the UI shows is a pure projection of on-disk files (`run.json`, `runs/`, `LOGS.md`, `TODO_AGENTS.md`, `tickets/`) or of git/gh reads — the server holds no run state of its own; live events stream over the Telefunc Channel from `events.jsonl`, steering goes through `control.jsonl`.
- One `DashboardOptions`/`DashboardContext` seam, three hosts: the daemon wires everything; the per-run foreground dashboard wires a single-project provider; the public relay wires an empty provider + in-memory events source so file/registry RPCs return nothing unauthenticated.
- Readers are forgiving throughout: a project that is missing, not a repo, without remote, or without `gh` contributes nothing or degrades — never a throw into a panel or watcher.
- Slow `gh` reads (~600ms) go through `cache.ts` and are allowed to arrive late (`pending`/`prPending`, #1028), so polls repaint on ~10ms git reads; write actions invalidate the relevant keys.
- Auth is layered by route class: the #1051 cookie guard on non-loopback binds, same-origin CSRF on `/_telefunc`, the bridge's own bearer token (the one deliberately cross-origin route), and the relay riding the #1051 cookie daemon-to-daemon.
- Handlers dispatched void must never throw (#938): an unhandled rejection kills the daemon, so parsers and static serving swallow malformed input into fallbacks.

## Facts

- Cross-file contracts: `keys.ts` item identities are the daemon's dedupe keys AND the browser's (shared via client.ts); `queue.ts`'s list-item rule must match the sweep's `parseTodoEntries` (#1296); `parseNumstat` in `file-diff.ts` is the one numstat parser (run-handoff.ts imports it); session branches live under `the-framework/` (`SESSION_BRANCH_PREFIX`).
- `RunMeta.sessionId` joins cloud runs to bridge questions; `RunMeta.ticket` joins live runs to hot tickets (#1117).
