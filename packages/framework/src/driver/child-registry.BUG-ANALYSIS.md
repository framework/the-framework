# Bug analysis: packages/framework/src/driver/child-registry.ts

## Business logic (high-level)

The stray-process net (driver SPEC "No stray processes"): every long-lived spawned CLI runs as its own process-group leader; `killTree` signals the whole group via a negative pid; `registerChild`/`unregisterChild` track live leaders; a lazily-installed `process.on('exit')` hook SIGKILLs every still-registered group on any exit path (normal completion, `process.exit`, post-uncaught-error unwind). Ctrl-C/SIGTERM are handled earlier by the CLI aborting agents; this is the last resort.

Lifecycle interplay with `cli-session.ts` (the only registrar): register right after spawn, unregister in the `close`/`error` cleanup. A child that never emits `close` (hung, SIGTERM-ignoring) stays registered until process exit — intended, that is the net.

Concurrency/ordering: everything is synchronous set mutation on one module-level `Set`; the exit hook is sync-only and `process.kill` is sync, satisfying `exit`-handler constraints. Idempotent registration (Set semantics), idempotent hook install (`exitHookInstalled` flag).

Edge cases considered:

- **Group already gone / pid never led a group** — `killTree` catches (ESRCH/EPERM), documented as not-an-error. Correct.
- **pid reuse** — a child that died but whose `close` has not yet been dispatched stays in `live`; if the daemon exits in that window the hook SIGKILLs `-pid`, which the OS could by then have reassigned to an unrelated process group. The window is milliseconds and Linux pid reuse requires wrap-around of the whole pid space, so this is a theoretical race every kill-by-pid system shares, not a defect worth code.
- **`registerChild` after the exit hook already ran** — cannot happen (exit hook runs during exit; no further JS spawns).
- **Signal deaths** — `exit` does not fire on an unhandled fatal signal (SIGKILL of the daemon itself); nothing can run then, and the spec scopes the net to exits that unwind. The CLI handles SIGINT/SIGTERM by aborting agents first (per comment), which routes through `cli-session`'s terminate → group kill.
- **SIGKILL as the exit-hook signal** — no grace, deliberately: the daemon is dying, sync-only context, and the SPEC says force-kill.

## Functions (low-level)

- **`killTree(pid, signal)`** — `process.kill(-pid, signal)` in try/catch. `pid` must be positive (a 0/negative input would signal the daemon's own group / another group — callers pass `child.pid`, always positive when present; `cli-session` guards `pid != null`). Never throws. Verdict: correct.
- **`registerChild(pid)`** — installs hook, adds pid. Verdict: correct.
- **`unregisterChild(pid)`** — deletes; missing pid a no-op. Verdict: correct.
- **`installExitHook()`** — once-guarded `process.on('exit', …)` iterating `live` with SIGKILL. Iterating a Set while `killTree` never mutates it — safe. Verdict: correct.

Noted reliance: only `cli-session.ts` registers children. `claude-code-quota.ts` spawns the CLI too but neither detaches nor registers — that gap is recorded against `claude-code-quota.ts`, not here.

## Bugs found

None found.
