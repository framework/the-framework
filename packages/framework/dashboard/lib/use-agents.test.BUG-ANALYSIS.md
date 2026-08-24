# Bug analysis: packages/framework/dashboard/lib/use-agents.test.ts

## Business logic (high-level)

Tests `useAgents` through a mocked `onAgents` with fake timers: no read without a project (10s advanced, zero calls), the 2s cadence, immediate `reload`, the headline race (a reload in flight during a project switch cannot write the old project's runs — the parked promise for `a` resolves *after* `b` is on screen and must not clobber it), switch-clears-first (empty list while `b` loads, not `a`'s rows), and keep-last-on-failure. These are exactly the SPEC's claims, each with an assertion that fails if the behaviour regresses; the race test in particular drives real out-of-order resolution rather than asserting on call counts.

Async discipline: `settle` wraps `advanceTimersByTimeAsync` in `act`; the two parked-promise tests resolve inside `act`/`settle` before asserting. `vi.useFakeTimers()`/`useRealTimers()` bracket each test. One nuance: in the race test, `result.current.reload()` is called outside `act` — it only *starts* a fetch (state writes happen later inside the settled `act`s), so no act-warning and no missed state.

Gap (noted, not a bug): `loaded` is untested here (covered indirectly by shell tests); the initial `[]` before the first answer for a *selected* project is asserted only via the switch test.

## Functions (low-level)

- `agents(id)` — one-row fixture cast to `AgentMeta[]`; enough to tell readings apart. Correct.
- "reads nothing until a project is selected" — call-count zero after 10s. Correct.
- "polls the selected project every 2s" — value swap across one tick. Correct.
- "reload shows a just-started run" — mock swap + reload, no timer advance. Correct.
- "a reload in flight during a project switch…" — parked `a` read, switch to `b`, settle, then resolve `a` late and assert `b1` stands. Genuinely exercises the token retirement. Correct.
- "switching project clears the previous project's runs" — asserts the empty in-between state synchronously after `rerender`, then `b`'s answer. Correct.
- "a failed read keeps the last runs" — rejection at the 2s tick, list retained, unhandled rejection would fail the run. Correct.

## Bugs found

None found.
