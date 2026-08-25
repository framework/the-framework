# Bug analysis: packages/framework/src/dashboard-rpc/context.ts

## Business logic (high-level)

The module-level wiring every dashboard RPC acts through (post-D3/F3: one host, wired once at boot, no per-request scoping). Three duties per `context.SPEC.md`:

1. **Wired once, fail loudly**: `setDashboardContext` stores the daemon's capabilities; each accessor reads one field and *throws naming it* when absent — a wiring bug, not a degraded host. Verified: `fromContext` checks `wired?.[key] === undefined` and throws `the dashboard's RPC context has no <key>`. RPCs that must never error at the browser (`onQuota`, `onAutoPm`, `onPreferences`) wrap their accessor in try/catch on their side, so the split of responsibilities holds.
2. **Agent-scoped resolution**: `resolveAgentPath` = project-id → workspace (`resolveProjectPath`) → `resolveAgentCheckout(cwd, agentId)`. The store's resolution (shared with the daemon) prefers a live meta's recorded cwd, then the worktree directory (the #766 first-seconds case: directory exists before `agent.json` does), then the project root for an unknown/finished/absent/unsafe id — matching the SPEC's "project workspace otherwise". An unsafe agent id cannot traverse (`isSafeAgentId` gate inside the store).
3. **Nothing relayed from a device**: `contextRemote` is the one accessor with a default (`NO_RELAYED_RUNS`) instead of a throw, because on the receiving side of `/_relay/rpc` "unwired" genuinely means "nothing is relayed from here" — forwarding onward would loop. `relay-dispatch.ts` relies on exactly this.

Concurrency/lifecycle: `wired` is a plain module global set once by the daemon (`rpc-serve.ts` calls `setDashboardContext` at mount time) and per-case by tests (`provideTestContext`). There is one daemon per process by design (foreground-only), so no torn reads. Within one test *file*, node:test runs cases serially, so per-case rewiring is safe; the daemon tests that run a real daemon in the same process as direct-RPC tests would cross-wire — no batch file does that.

Edge cases: a context wired with an explicitly-`undefined` field throws identically to an unwired one (fine — same wiring bug); `resolveProjectPath` resolves through `defaultProjectsProvider()` which reads the registry via `process.env` — the daemon's injected `opts.env` is *not* consulted here. In production both are `process.env`; the daemon tests document the asymmetry and set `process.env.XDG_CONFIG_HOME` around steering calls. Reliance noted, not a bug.

## Functions (low-level)

- **`setDashboardContext(context)`** — assigns the global. Correct.
- **`fromContext(key)`** — throw-on-absent read. Correct.
- **`NO_RELAYED_RUNS`** — `{target: () => undefined, list: () => []}`; inert and side-effect free. Correct.
- **`contextProjects()`** — returns a fresh `defaultProjectsProvider()` per call (the registry is re-read per call, which is what keeps the list current with no cache invalidation). Correct.
- **`resolveProjectPath(projectId)`** — `undefined` for an unknown id; every caller answers empty/error on that. Correct.
- **`resolveAgentPath(projectId, agentId?)`** — described above; `undefined` only for an unknown project (the store's resolution itself never returns undefined). Correct.
- **`contextEventsSource` / `contextPreferences` / `contextDiscord` / `contextQuota` / `contextAutoPm` / `contextAutoPmSweep` / `contextProjectErrors` / `contextStartAgent` / `contextAddProject`** — throwing accessors over `fromContext`. Correct.
- **`contextRemote()`** — `wired?.remote ?? NO_RELAYED_RUNS`; the deliberate non-throwing exception, with the rationale in both doc and SPEC. Correct.

## Bugs found

None found.
