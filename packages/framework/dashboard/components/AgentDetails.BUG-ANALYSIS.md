# Bug analysis: packages/framework/dashboard/components/AgentDetails.tsx

## Business logic (high-level)

The "about this agent" strip behind the action bar disclosure: driver label, model, and the spend
readout folded from `usage` events (#322). Pure projection of the `events` prop (the same `shown`
feed `AgentView` renders), no state, no effects — nothing to leak or race. Per its SPEC it must
not repeat branch/PR/changes (it doesn't), must abbreviate token counts, and must say "No spend
reported yet" before the first usage event (it does).

Data contracts verified against `src/events.ts` and `src/agent-view.ts`:

- `usage` event: `costUsd?` optional (guarded with `!== undefined` — correct, since `$0.00` for a
  driver that reports no price would be wrong, per #540), `inputTokens`/`outputTokens`/
  `cacheReadTokens`/`cacheCreationTokens`/`turns` always present — unconditional access is safe.
- `sessionInfo` folds the latest `session` + `session-update`; `driverFromImpl` maps impl ids
  (`claude-code`→`claude` etc.), label falls back to the raw impl id (so a `fake` run shows
  "fake") and finally to "Agent" when no session event exists yet. Reasonable for every reachable
  state.

Resumed-agent nuance (recorded, not asserted as a bug): each leg runs a fresh `UsageMeter`
(`createDriverEventHandler` in `src/agent-telemetry.ts`), so `usage` events are cumulative **per
leg**. `lastUsage` takes the last event in the whole journal, i.e. a resumed agent's strip shows
only the newest leg's spend while the SPEC says "what it has spent so far". Whether "it" is the
agent (all legs) or the current session leg is not pinned anywhere; every other surface (terminal,
overview) reads the same last event, so this is a consistent product choice rather than a defect
of this file. Suspicious-but-unproven; reported at low confidence since the SPEC wording leans
toward the whole agent.

## Functions (low-level)

- **`lastUsage(events)` (L13)** — backwards scan for the last `usage` event. Correct for empty
  input (undefined → "No spend reported yet"). Scans the whole feed rather than
  `currentAgentEvents`; see the per-leg note above (the last event of the whole feed *is* the last
  event of the current leg, so segment-slicing would change nothing). Correct.
- **`compact(n)` (L22)** — `>= 1M` → `X.XM`, `>= 1k` → `X.Xk`, else raw. Edge: 999_950–999_999
  renders "1000.0k" rather than "1.0M"; cosmetic rounding seam, tokens are never negative or
  fractional. No `NaN` sources (fields are typed numbers from the meter). Correct (cosmetic edge
  noted, not a bug).
- **`Fact` (L28)** — label/value span. Correct.
- **`AgentDetails` (L37)** — renders Agent always; Model only when the latest `session` event
  recorded one (a leg that recorded none clears it — matches `sessionInfo`'s per-leg fold);
  Spent only with `costUsd`; Tokens+Turns whenever any usage exists; Cache row only when either
  cache counter is > 0. All conditionals match the event shapes. Correct.

## Bugs found

1. **L13/L41: a resumed agent's spend strip shows only the current leg's totals.** Scenario:
   an agent spends $0.80, is stopped, and is resumed; the continuation spends $0.10 — the strip
   reads "Spent $0.10 / Turns N(leg2)", although the SPEC for this strip says it shows "what it
   has spent so far" and the product's unit of work is the agent (one entry across
   continuations, MEMORY.md D5, #762). Root cause is that each leg's `UsageMeter` restarts at
   zero (`src/agent-telemetry.ts` `createDriverEventHandler`) and this strip renders the last
   `usage` event as the whole truth. Severity: minor (under-reported spend readout; the budget
   cap has the same per-leg scope by design). Confidence: low — every surface shares this
   reading, so it may be the intended meaning of "spent so far". Fix sketch (if intended to be
   whole-agent): sum the final `usage` event of each `session` segment in `lastUsage` (or fold a
   running offset when a new `session` boundary follows a `usage` event).
