# Bug analysis: packages/framework/dashboard/lib/use-agent-handoff.ts

## Business logic (high-level)

One shared handoff read for the agent view (#1026/#1028): polls `onAgentHandoff` at 15s, tightens to 1s while `prPending`, keeps the last answer across cadence flips and reloads (`keepPrevious`), exposes `loaded` (no empty-state flash), and wraps the Push/PR/Merge buttons via `useAction` plus a `pending` marker naming the button in flight. Checked against `use-agent-handoff.SPEC.md`:

- **One answer, two places** — the hook is instantiated once by the agent view and its value handed down; enforced by the callers, this file just makes it possible. Holds.
- **Nothing while running / skipped when not needed** — `enabled && agentId ? load : null`; `usePolled` never calls a null load. Holds.
- **15s cadence, 1s while a PR is pending** — `everyMs` state flipped by the effect on `handoff?.prPending`; `everyMs` is in the dep list so the interval restarts, and the effect restart issues an immediate read (so the 1s chase begins now, not a tick later). Flip-back to 15s when `prPending` clears (including via `handoff` becoming null — `undefined` is falsy). Holds.
- **The last answer stays on screen** — `keepPrevious = true`, so the dep-change reset (which the `everyMs` flip triggers) keeps the value; `loaded` still resets, which callers use only against the *first* answer, so no blank. Holds.
- **The button in flight says so; success re-reads immediately** — `act` sets `pending`, `run` executes, `.then` clears `pending` and calls `reload()` only when `run` returned a value (i.e. real success — every wired RPC returns an `{ok, …}` object, so the void-undefined ambiguity of `useAction` is not in play; verified for `sendMerge`/`sendOpenPullRequest` call sites). Holds.

Concurrency/ordering:

- Two `act`s cannot overlap from the UI: the buttons disable on `busy` (AgentHandoff.tsx), and `pending` is only meaningful under that discipline. If they somehow did overlap, the first settle would null `pending` while the second is in flight — accepted reliance on the disable pattern, same as `useAction` itself.
- `run(...).then(...)` cannot reject (`run` catches everything), so the `void`-ed chain leaves no unhandled rejection.
- A `reload` issued right as `everyMs` flips uses the *current* effect's token (`liveRef`), so a cadence restart between click and response drops the stale write — `use-async`'s token discipline covers it.
- Navigating to another agent mid-action: `pending` state is component-local and the RPC was aimed at the explicit `(projectId, agentId)` pair captured at click time — the action completes against the right agent; the `reload` then re-reads the *new* deps' load (or is dropped if unmounted). Sound.

## Functions (low-level)

- `AgentHandoffState` — shape as documented; `pending` narrows to the three button names. Correct.
- `useAgentHandoff(projectId, agentId, enabled=true)` — deps `[projectId, agentId, enabled, everyMs]` exactly match what the load closure and cadence depend on (the `use-async` contract "load must close over exactly deps" — `everyMs` is extra but harmless: it only forces the restart that is the point). Correct.
- cadence effect — depends on `handoff?.prPending`; setState-to-same-value re-renders are skipped by React, so the 15s steady state does not loop. Correct.
- `act(which, fn, fallback)` — as analysed. Not memoised (new identity per render) — consumers call it from event handlers, never depend on identity. Correct.

## Bugs found

None found.
