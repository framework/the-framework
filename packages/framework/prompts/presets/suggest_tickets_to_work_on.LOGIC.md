The "Suggest tickets to work on" preset of the launcher, the gated sibling of the two triage presets: the agent [1] looks at all tickets, picks the ones to work on next, shows them as a multi-select with its confident picks checked, stops at a gate [2] for the user's approval, and puts each approved ticket on the agent queue [3] at the ticket's own priority. Its tooltip reads "Add tickets to queue (TODO_AGENTS.md)". It takes no parameter. Because it ends in a gate, it is never fired by the daemon: an unattended [5] agent nobody answers would be wedged against a human who is not there, so it stays a launcher button only.

## Context

**User story**: the user clicks "Suggest tickets to work on" in a project's launcher and gets a card listing the tickets the agent proposes to work next, the strong candidates already ticked; whatever the user leaves ticked lands on the agent queue, linked to its ticket, and the queue's drain works it from there.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent. When nobody can answer, the recommended option is taken.
[3] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[4] skill: one of the four capabilities an agent is taught (`branches`, `tickets`, `queue`, `logs`), each a package with the instructions the agent reads, a command on the agent's PATH, and an API the product calls.
[5] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.
[6] pick: the answer to a gate: the option or options chosen, by the user or automatically.

## Business logic — TL;DR

- **Pick from all tickets** - the agent reads all tickets through `tickets list` of the `tickets` skill [4] and picks the ones to work on next.
- **Show the picks and wait** - it shows them as a multi-select, each ticket checked by default only when the agent has high confidence it is a good candidate to work on next, and stops at a gate [2] until the user answers.
- **Queue each approved ticket** - for every ticket in the pick [6], it adds `[<title>](tickets/<file>)` to the agent queue with `queue add ... --priority <N>` from the `queue` skill, where N is the ticket's own `Priority:`, or 5 when the ticket has none.
