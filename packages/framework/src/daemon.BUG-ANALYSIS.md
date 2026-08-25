# Bug analysis: packages/framework/src/daemon.ts

## Business logic (high-level)

The daemon body: bare `the-framework` runs `runDaemon(cwd)` in the foreground. Responsibilities, per `daemon.SPEC.md`:

- **Boot sequence**: create `.the-framework/` up front (works in a fresh workspace), register the activated home workspace as a project (best-effort, skipping a cwd nested in an already-tracked project, #647), reconcile agents a dead daemon left marked `running` (#642).
- **Bind rules**: loopback (default `127.0.0.1:4200`) needs no secret; a non-loopback host generates/persists the shared token (#1051). The browser bridge is opt-in via the `bridge` preference and reuses the same token (#1237).
- **Wiring**: one `createProjectRuntime` (spawning, relay, teardown), one `startDashboard` (HTTP + RPC mount), one long-lived quota source shared by the panel and the background services (#685/#960), `startBackgroundServices` (auto PM, CI watch, Discord, sweeps). Settings act immediately: a Discord save rebuilds the services; a preferences write that flips `autoPm` on wakes the sweep; `autoPmSweep` is the on-demand click.
- **Shutdown order** (#923/#1646): quiesce services → stop agents (log their ids) → stop the quota meter → dispose runtime → close the server. Nothing is resumed at boot.

Edge cases examined:

- **Fresh workspace**: `mkdir(daemonDir, {recursive:true})` before anything else — pinned by a test. Correct.
- **`registerHomeProject`**: `isActivated` catch→false, `listProjects` catch→[], `addProject` catch→{} — never blocks boot; `addProject` dedupes by path so the equal-path case (where `isNestedWithin` deliberately answers false) is safe. Correct.
- **Reconcile loop**: per-project `catch(() => 0)`, serial awaits; a project with an unreadable store fixes 0 and logs nothing. Correct.
- **Post-bind failure**: the `try` around `onListening` closes the dashboard and rethrows, so the port is freed — but see Bugs: the quota poller and runtime are not torn down on any failure path, and a *pre*-`onListening` failure (`startDashboard` rejecting, e.g. `EADDRINUSE`) tears down nothing at all.
- **`startBackgroundServices` throwing**: it sits after the `try` block; a synchronous throw there would leave the dashboard bound (violating the SPEC's "server torn down before the failure is reported"). Inspected `daemon-services.ts`: it is pure wiring (`startAutoPm`, `startCiWatch`, `startDaemonTick`, …) with no I/O before returning, so I could not find a reachable throw — suspicious-but-unproven, not reported.
- **Shutdown rejections**: if `services.quiesce()` or `runtime.dispose()` rejected, the later steps (including `dashboard.close()`) would be skipped and the process would hang. `quiesce` awaits `clock.stop()` (tick module guards its own rejections) and `dispose` only drops in-memory relay state, so no reachable rejection found — noted, not reported.
- **Env asymmetry**: the daemon reads the registry through `opts.env`, but the RPC layer (`dashboard-rpc/context.ts`) reads through `process.env`. In production both are `process.env`; the tests document and work around it. Reliance noted, not a bug.
- **Stale comment**: L260 "before the previews they may be serving" — the app-preview feature has been removed from the codebase (no preview RPCs exist; `ProjectRuntime.dispose` only disposes relay state); part of the preview-drift finding attributed to `dashboard-rpc/control.ts`.

## Functions (low-level)

- **`DEFAULT_DAEMON_PORT` / `DEFAULT_DAEMON_HOST`** — 4200 / `127.0.0.1`. Correct.
- **`isLoopbackHost` (re-export)** — lives in a leaf module to avoid an import cycle. Correct.
- **`daemonDir(cwd)`** — `join(cwd, FRAMEWORK_DIR)`. Correct.
- **`isNestedWithin(child, parent)`** — `relative()` then rejects `''`, `..`-prefixed and absolute results. Handles equal, parent, sibling, and name-prefix (`/repo-x` vs `/repo`) cases; pinned by tests. Assumes both args absolute (all callers pass absolute). Correct.
- **`registerHomeProject(cwd, env)`** — described above; best-effort and idempotent. Correct.
- **`isProcessAlive` (re-export of `isPidAlive`)** — signal-0 probe. Correct.
- **`EventTailer`** — `JsonlTailer<FrameworkEvent>` under the historical name. The base class detects shrink and same-length rewrites; a rewrite that *grows* past the consumed offset within one poll interval would be misread (tail of the new file spliced after the old events) — in practice a fresh agent truncates to empty/short first, so the shrink check catches it; noted as a theoretical gap in `jsonl-tail.ts` (other batch), not reported.
- **`runDaemon(cwd, opts)`** — the body. Token/bridge resolution (`ensureDaemonToken` only when needed; bridge preference read with catch→{}), mkdir, home registration, reconcile, runtime creation, `startDashboard`, `onListening` report with teardown-on-throw, `startBackgroundServices`, `waitForShutdown`, ordered teardown. **Bug found** (quota/runtime leak on failed start, below). The `actualPort` fallback `Number(new URL(...).port) || port` can only misreport when the URL carries no port (never: `startDashboard` reports the bound ephemeral port). The `daemonUrl` closure is assigned before any spawn can read it (spawns require the RPC surface, up only after). Otherwise correct.
- **`waitForShutdown(signal)`** — resolves once on SIGINT/SIGTERM/abort, removing all three hooks; pre-aborted signal short-circuits. Listener accounting is exact (`once` + `off`). Correct.
- **`listBridgeSessions(env)`** — projects catch→[], per-project `readAllAgents` catch→[] (one unreadable repo cannot empty the list, per SPEC), `bridgeSessionsFrom(agents, new Date())` filters `target==='web'` with a session id inside the window. Correct.

## Bugs found

1. **L178/L221–229 (fix at both): a failed start leaves the quota poller running (and the runtime undisposed)** — `defaultQuotaSource()` starts polling immediately: its first read spawns `claude -p /usage` (~5s, 20s timeout whose timer is deliberately *not* unref'd in `readClaudeQuota`). If `startDashboard` then rejects — concretely, `EADDRINUSE` on port 4200 because a daemon is already running, an entirely ordinary user action (`server.once('error', reject)` in `dashboard/server.ts` L278) — `runDaemon` rejects with `quota.stop()` never called and `runtime.dispose()` never run. The CLI (`runForegroundDaemonCmd`) prints "could not start the dashboard" and returns 1, but `bin.ts` only sets `process.exitCode`, so the process sits for up to ~20s on the non-unref'd timer/child before exiting — and the wasted read spends the upstream rate-limited usage fetch, whose penalty ("refused upstream if asked too often", minutes long) then degrades the *running* daemon's quota panel for the same account. The same leak exists in the post-bind catch (L224–229), which closes the dashboard but not the meter — contradicting the SPEC's "the meter is stopped by the daemon on the way out" and the spirit of "a failed start cannot leave a process … holding the event loop open". Severity: minor. Fix: wrap `startDashboard` + the `onListening` block so any failure runs `quota.stop()` (and `await runtime.dispose()`) before rethrowing, e.g. `let dashboard: Dashboard; try { dashboard = await startDashboard({...}) } catch (err) { quota.stop(); await runtime.dispose(); throw err }`, and add the same two calls to the existing catch.

Cross-file, recorded here because noticed here: the stale "previews" comment at L260 belongs to the preview-drift bug attributed to `packages/framework/src/dashboard-rpc/control.ts`.
