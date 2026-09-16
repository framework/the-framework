The "Add consensual work to AI Queue" preset of the launcher: the agent [1] reads every ticket and puts on the agent queue [2] the ones that are significant, so not quick wins, and consensual, with zero open questions and zero variability, each at the ticket's own priority. Its tooltip reads "Add `tickets/*.md` to queue (TODO_AGENTS.md), only significant (no quick-wins) and consensual tickets". The prompt ends with the queue-only rule of `triage_scope.md`, appended by the table in `src/preset-catalog.ts`: the agent queues work and never does it. It takes no parameter and always names its work `triage-consensual`.

## Context

**User story**: the user clicks "Add consensual work to AI Queue" in a project's launcher and the substantial tickets nobody disputes reach the agent queue without the user approving each one, while anything with an open question or several plausible designs stays off the queue until a human weighs in.

**Business logic story**: the triage pair, this preset and "Add quick-win work to AI Queue", is how the queue refills itself from the tickets; both pick only consensual tickets, needing no human, and split on cost so that the cheap batch and the significant batch can be queued separately. The fixed session name [4] makes its branch `agent-triage-consensual` on every run.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[3] plan: a ticket's `.plan.md`: effort and uncertainty ratings and how to implement it.
[4] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[5] skill: one of the four capabilities an agent is taught (`branches`, `tickets`, `queue`, `logs`), each a package with the instructions the agent reads, a command on the agent's PATH, and an API the product calls.

## Business logic — TL;DR

- **Pick the significant, consensual tickets** - from `tickets list` of the `tickets` skill [5], which shows each ticket's `effort` and `uncertainty`, the agent picks only tickets that are significant, no quick wins, and consensual: zero open questions and zero variability, for instance a single fairly obvious plan [3].
- **Queue each pick at its own priority** - each picked ticket goes on the agent queue as `[<title>](tickets/<file>)` through `queue add ... --priority <N>` from the `queue` skill, where N is the ticket's own `Priority:`, or 5 when the ticket has none.
- **A fixed name** - the session name [4] is always `triage-consensual`.
- **Queue only** - per `triage_scope.md`, the agent changes nothing but the queue: no ticket is implemented, however small its plan, and no pull request is opened.
