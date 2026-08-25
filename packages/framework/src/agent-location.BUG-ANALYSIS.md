# Bug analysis: packages/framework/src/agent-location.ts

## Business logic (high-level)

Names the run-target axis (D1): the `AgentLocation` union, the `AGENT_LOCATIONS` list for
validating browser/config input, and `isHandsOff` — the one behavioral fact (`web` alone is
hands-off; `actions` streams real replies and is followed like local). Node-free on purpose so
the dashboard/registry/store can import it; verified: the module imports nothing at all.

Checks:
- `AGENT_LOCATIONS` and the union stay in lockstep by hand — a drift would be caught by
  `isAgentLocation`'s cast usage in TypeScript only partially (the array is `as const` and typed
  readonly, but nothing forces exhaustiveness). With three literals a foot apart, acceptable
  under the project's simplicity rule; noted as reliance.
- `isAgentLocation(value)` — string check + includes; rejects non-strings, unknown names, and
  case variants (deliberate: the wire format is exact). Correct.
- `isHandsOff(location)` — `location === 'web'`; `undefined` (no target named) → false, i.e. a
  local default is followed. Matches the SPEC exactly, and `agent.ts`/`cli.ts` both route
  through it (`isHandsOff(opts.location)` / `isHandsOff(opts.target)`), so the fact lives in one
  place as intended.

## Functions (low-level)

- `isAgentLocation` — verdict: correct.
- `isHandsOff` — verdict: correct.
- `AGENT_LOCATIONS`, `AgentLocation` — verdict: correct.

## Bugs found

None found.
