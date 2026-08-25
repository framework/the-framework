# Bug analysis: packages/framework/src/dashboard/open-questions.ts

## Business logic (high-level)

Pools every parked question across all projects (#1455 item 4): each running agent's pending gate (full `ChoiceRequest`, read from the agent's own worktree log — not the meta, which only carries id+title), plus every question the Claude web bridge holds for a cloud session (#1237/#1554), joined to the `web`-target agent that handed off. Invariants per SPEC:

- only genuinely open gates: the log must show the `choice` with no later `choice-resolved` for the same id — otherwise the card would offer an answer the daemon refuses; a bridged question is offered only while no answer is already queued (`unansweredBridgeQuestions` filters on `pendingAnswer`);
- the bridged join runs against `readAllAgents` (archived included) because a web agent is `done` at hand-off and its checkout may be gone; the archive is read only when something is bridged (verified by the test's read counter);
- one card per bridged question even when two checkouts share the tf-data archive: a global `claimed` set, first project wins (registry order);
- longest-waiting first: ascending `localeCompare` on ISO `updatedAt` (local agent: last spoke; bridged: `receivedAt`) — lexicographic order is chronological for the store's uniform ISO-Z format; missing timestamps sort first (treated as longest-waiting — a defensible default);
- forgiving: `liveAgents`, `events`, `agents` reads are individually `.catch`'d to empty, so one broken project never breaks the list. `bridged()` itself is synchronous over the in-memory store and cannot fail in production.

Ordering/duplication analysis: a web agent cannot double-appear via both loops (its live meta is not `running` post-hand-off, and `cloudSeen`-style claiming is handled by `claimed`). Two archive agents with the same `sessionId` would double-claim… `find` with `claimed` prevents a second card for the same question; a second *agent* matching the same session finds no unclaimed question. Sound.

## Functions (low-level)

- **`unansweredBridgeQuestions()`** — `store.list().filter(q => !store.pendingAnswer(q.sessionId))`. Matches the "answer already on its way" rule. Correct (unit-untested; exercised only via default wiring — noted).
- **`openChoiceRequest(events, gateId)`** — linear scan keeping the last unresolved `choice` for the id; `choice-resolved` clears; a re-fired same-id gate re-opens (tested). Strips `kind` via rest destructuring, leaving the full request (options, multi, recommended, detail). Empty log → undefined. Correct.
- **`buildOpenQuestions(projects, deps)`** — per project: live loop filters `status === 'running' && pendingChoice`, reads the log from `meta.cwd` (the worktree — tested), skips when the gate is not open. Bridged loop: gated on `bridged.length` (archive not read otherwise), filters `target === 'web' && sessionId`, claims, builds the card with `bridgeChoiceRequest` (options answerable by label), `updatedAt: receivedAt`, and the claude.ai URL from the session id. Card spreads optional `sessionName`/`intent` only when present. Final sort ascending. Edge cases: a bridged question matching no agent is dropped (tested); duplicate gate ids across *different agents* are safe (each agent's log is read separately); a `running` agent whose log read fails contributes nothing (catch → `[]` → gate not open). Verdict: correct.

## Bugs found

None found.
