# Bug analysis: packages/framework/dashboard/lib/use-start-agent.ts

## Business logic (high-level)

The one shared mutation hook for starting an agent (SPEC: both composers route through here so
the busy refusal reads identically; daemon's `busy` refusal is re-worded; other reasonless
failures read "Failed to start the agent."; in-flight reports busy; success returns the new
agent's identity).

Flow: `start(...)` → `useAction().run(async () => { outcome = await sendStart(...); if (!ok &&
busy) return {...outcome, error: <reworded>}; return outcome }, fallback)`.

- `useAction.run` treats any `{ok: false}` result as failure: sets `error` to `result.error ??
  fallback` and resolves `undefined`. So: daemon busy → the reworded string; daemon `{ok:false,
  error: 'x'}` → 'x'; `{ok:false}` bare → the fallback; a thrown/network error → its message or the
  fallback. All four routes match the SPEC.
- `start` then returns `result?.ok ? result : undefined` — belt and braces on top of run's own
  undefined-on-failure; the success branch carries `agentId?` through untouched.
- `busy` is `useAction`'s flag, set for the whole RPC round-trip; `reset` clears the error (used
  when the user edits the prompt). Both surfaces read the same words. Correct.
- The custom `fallback` parameter lets the continuation composer name its own failure line while
  defaulting to "Failed to start the agent." — matches the SPEC's wording.

Edge cases: concurrent `start` calls share one busy flag (second click while busy is the caller's
concern; the composers disable the button on `busy`). A `busy: true` outcome that also carried a
daemon `error` string is deliberately overridden by the dashboard's phrasing — that is the
documented intent ("the daemon's refusal is phrased for its own log").

## Functions (low-level)

- `useStartAgent()` — returns `{busy, error, reset, start}`. `StartArgs` indexes `sendStart`'s
  parameter tuple so the kind/options types track the implementation (verified: sendStart in
  src/dashboard-rpc/control.ts takes (projectId, prompt, kind, options) and validates the empty
  prompt server-side, returning `{ok:false, error}` — which run() surfaces). Verdict: correct.
- `start(projectId, text, kind, options, fallback)` — analyzed above. Verdict: correct.

## Bugs found

None found.
