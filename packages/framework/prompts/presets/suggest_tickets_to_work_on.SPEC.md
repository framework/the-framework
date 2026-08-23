The suggest-tickets-to-work-on preset: the agent reads all tickets, picks the ones to work on next, and offers them to the user as a multi-select gate — pre-checking only the ones it is highly confident about — then appends the tickets the user approved to the agent queue (`TODO_AGENTS.md`).

## Business logic — TL;DR

- **The agent shortlists, the user approves** - the agent's picks are a proposal; only what the user selects reaches the agent queue.
- **Confidence sets the default selection** - a ticket the agent is highly confident is a good candidate to work on next starts checked; every other ticket starts unchecked.
- **It always waits** - the preset ends in a gate, so it is never fired unattended.

## Business logic

### The agent shortlists, the user approves

#### User story

The user wants help choosing what to work on next but keeps the choice: what lands on the agent queue is what they ticked, not what the agent liked.

#### Business logic

The agent looks at all tickets and picks the ones to work on next, shows exactly those picks as a multi-select gate, and stops. Its confidence is expressed as the default state of each entry — checked when it is highly confident the ticket is a good candidate, unchecked otherwise — so answering can be as cheap as accepting the defaults. Once the user answers, the approved tickets are appended to the agent queue.

#### Rationale

Because this preset always ends at a gate, it is kept out of the daemon's unattended rotation: firing it with nobody around would park an agent on a question no one is there to answer.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
