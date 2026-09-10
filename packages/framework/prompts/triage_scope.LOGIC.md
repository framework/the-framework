The queue-only rule that ends both triage presets, "Add quick-win work to AI Queue" and "Add consensual work to AI Queue", appended to each by the table in `src/preset-catalog.ts` so the pair cannot drift apart on it: a triage agent [1] only queues work and never does it. The only thing it may change is the agent queue [2], through `queue add`; it must not implement a ticket however small the ticket's plan is, make any code change, or open a pull request for it. Every ticket it picks goes on the queue, where the user can still veto it before an agent implements it.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
