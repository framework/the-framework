Fixes the shape of a question a cloud session [1] is parked on, as the Claude web bridge [2] carries it, and projects it onto the gate [3] the dashboard's gate panel renders — the same panel a local agent's [4] question gets — with option labels standing in for option ids, because a claude.ai page has no ids and a label is what the extension can type back. The projection depends on nothing of the daemon's, so the dashboard app computes it itself.

## Glossary

[1] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[2] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[3] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.
[4] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[5] pick: the answer to a gate: the option or options chosen, by the user or automatically.

## Business logic — TL;DR

- **A bridged question** - the cloud session's id, a title, its options (a label, an optional one-line detail, whether it starts checked on a multi-select, whether picking it hands the session back to the user), an optional recommended label, whether several options may be picked, and when the daemon accepted it — a time the daemon sets, never the caller.
- **As the gate panel renders it** - the gate [3] is identified as `bridge:<session id>`; each option's id is its label; the detail, the pre-checked default, the recommended label and the multi-select flag carry over; the stop flag does not reach the panel, because the store applies it when it composes the pick's [5] text (`bridge-store.ts`).
