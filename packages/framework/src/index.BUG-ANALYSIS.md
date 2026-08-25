# Bug analysis: packages/framework/src/index.ts

## Business logic (high-level)

The type-only vocabulary of the daemon's RPC answers, for the dashboard to import from one place. Two self-stated invariants (file header):

1. **Type-only** — a value re-export would drag node modules into the browser bundle. Verified: every line is `export type { ... }`; nothing exports a value. Holds.
2. **"Every name below is imported by a file under `dashboard/` … a name nothing renders cannot quietly live on in it."** Verified mechanically: I extracted every name the 90 dashboard files import from `../src/index.js` and diffed against the export list. Two exported names have **no importer anywhere under `dashboard/`** (nor any use of the identifier at all there): `AgentError` (line 16) and `BridgeOption` (line 28). Every other exported name (45 of 47) is imported by at least one dashboard file. So the file's own rule is violated for those two names — the exact "quietly live on" failure the header forbids.

There is no test enforcing invariant 2 (the graph test in `client.test.ts` enforces browser-safety, not consumer-existence), which is how the two strays survived. Both types remain used *inside* `src/` (`AgentError` by `agent-view.ts`'s `agentErrors()`, `BridgeOption` by `BridgeQuestion`), so only the re-export line is dead, not the types themselves — dashboard code touches them structurally (e.g. `question.options`) without naming them.

No other logic exists in the file; there is nothing to race, no runtime behavior, and `export type` guarantees build-time erasure.

## Functions (low-level)

- **47 `export type` lines** — each re-exports a named type from its defining module. Spot-checked resolution targets exist (`agent-view.ts`, `bridge-question.ts`, `store/agent-store.ts`, …). No duplicate names across lines (a duplicate would be a compile error anyway). Verdict: correct except the two consumer-less names above.

## Bugs found

1. `L16` (and `L28`): `AgentError` and `BridgeOption` are exported "for the dashboard" but no file under `dashboard/` imports either name (verified by exhaustive grep over all dashboard imports of `src/index.js`). This contradicts the module's explicit rule that it "ends where its consumers end". Behaviorally inert (types erase), so severity: minor; confidence high on the fact, medium on bug-worthiness. Fix sketch: remove `AgentError` from line 16 and drop `BridgeOption` from line 28 (keep `BridgeQuestion`).
