The skill's instructions: what an agent is told about the project's tickets and its agent queue — where they live, how to read and change them, how to claim one so no two agents work the same ticket, and the formats a ticket, a plan and the queue are written in.

## User story

- The user expects agents to pick up work from one queue, to plan and implement tickets without two of them landing on the same one, and to leave the tickets current — without the user having to put any of that in a prompt.

## Business logic — TL;DR

- **The tickets are on a branch, not in your checkout** - the tickets (`tickets/<DATE>_<SLUG>.md`, with their `.plan.md` and `.lock.md` siblings) and the queue (`TODO_AGENTS.md`) live on the `agent-data` branch, never on a code branch; the agent's own checkout does not contain them. A `tickets` link at the repository root may show them: read there if you like, never write there.
- **The `tickets` command is the only way to change them** - it ships with the `@gemstack/skill-tickets` package the repository depends on: the agent installs the repository's dependencies once and runs `npx tickets`, so every command the skill names runs as written on a fresh clone. Every change it makes is one commit pushed straight to the `agent-data` branch; nothing the agent commits on its own branch reaches them, and these files never belong on the agent's branch.
- **Read: `list`, `show`, `queue`** - every open ticket as JSON, one ticket with its plan and its holder, and the queue's open entries in order of work.
- **Change: `put`, `close`, `queue add`, `queue done`** - write a ticket, a plan or the import stamp from standard input; remove a ticket with its plan and claim, because `tickets/` holds only open tickets — refused while someone else holds the ticket; put an entry on the queue, optionally linked to a ticket and placed by that ticket's priority; take an entry off, which deletes it.
- **Claim before you plan or work a ticket** - `tickets claim` says the ticket is yours or names who holds it; someone else's claim means back off and pick another, and never remove or overwrite their lock. `tickets release` lifts the agent's own claim when the plan is finished or the work is published.
- **The formats** - a ticket (its optional `Priority:`, `Topics:` and `GitHub:` keys, its title, its `## TLDR` and `## Why it matters`); a claim (one line, `CLAIMED: <holder>`); a plan (its `Effort:` and `Uncertainty:` on a 0–10 scale, with the sections it may use and how to gauge uncertainty by listing each aspect and rating it); and the queue (`## Priority N` sections from 10, critical and to be acted on immediately, down to 0, only if capacity, first within a band first to be taken).

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
