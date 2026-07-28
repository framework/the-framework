The agent-facing surface of the ledger: `decisionTools` exposes it as ai-sdk tools and `decisionBriefing` front-loads the rejected set into a system prompt — how the "consult before proposing, append on decide" policy reaches the model.

## TLDR

- `consult_decisions` tool: input `{ idea }`, returns `{ matches: [{ title, status, rationale, score }] }` (score rounded to 2 decimals); a rejected match means "do not re-propose".
- `record_decision` tool: input `{ title, status, rationale, tags? }`, records into the ledger, returns `{ ok, id }` with model output `recorded <id>`; disabled via `record: false`.
- `decisionBriefing(ledger)`: renders rejected ideas as a "do not propose again unless the user reopens the question" prompt fragment; returns `''` when nothing is rejected so it concatenates unconditionally.

## Facts

- `onRecord(ledger)` is awaited after each `record_decision` so callers can persist (e.g. `() => saveLedger(fs, ledger)`); a rejection surfaces as a tool error.
- `prefix` namespaces tool names (`decisions` → `decisions_consult_decisions`) for agents that already have a same-named tool.
- Tools are built with `toolDefinition(...).server(...)` from `@gemstack/ai-sdk` and cast to `AnyTool`.
