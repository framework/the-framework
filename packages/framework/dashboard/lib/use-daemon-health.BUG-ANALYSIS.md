# Bug analysis: packages/framework/dashboard/lib/use-daemon-health.ts

## Business logic (high-level)

The liveness probe (#948): `onProjects()` every 5s, `healthy` state flipped by the outcome, so the shell can say "unreachable" instead of freezing silently (live channels retry without a verdict; polled reads keep their last value). SPEC obligations:

- **Same pace healthy or not** — both the resolve and reject branches schedule the next probe at `PROBE_MS`. Holds.
- **Probes never pile up** — the next `setTimeout` is armed only from the previous probe's settlement (chained timeout, not an interval), so a slow/hung request delays rather than stacks. Holds — and this is exactly why `setTimeout`-chaining was chosen over `setInterval`.
- **Assume health until a probe fails** — initial state `true`. Holds.
- **Recovery is automatic** — a later success flips back; nothing else needed. Holds.

Lifecycle: `cancelled` flag plus `clearTimeout` in cleanup. The one in-flight `onProjects()` at unmount settles into the `if (cancelled) return` guard — no setState-after-unmount, no rescheduling, and the promise is consumed (both callbacks provided to `.then(onOk, onErr)`, so a rejection is handled, never unhandled). `timer` is `undefined` while a probe is in flight — cleanup during that window clears nothing but `cancelled` covers it. StrictMode double-mount: two probe chains start, the first is cancelled at its first settlement check; transiently two RPCs, then one chain — benign.

Setting state to its current value (`setHealthy(true)` every 5s while healthy) re-renders nothing (React bails on identical state). Multiple components using the hook each run their own probe chain — in practice only the shell does (per its comment); accepted.

## Functions (low-level)

- `PROBE_MS` — 5s, matches SPEC. Correct.
- `useDaemonHealth()` — effect with `[]` deps (nothing external captured); `probe` recursion via settled callbacks; two-argument `.then` keeps the rejection handled even if the resolve handler threw (it cannot — setState and setTimeout don't throw here). Returns the boolean. Verdict: correct.

## Bugs found

None found.
