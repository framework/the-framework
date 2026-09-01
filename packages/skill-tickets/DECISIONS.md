Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating.

## The tickets
- Markdown files are the ticketing system: `tickets/<DATE>_<SLUG>.md`, with the plan and
  the claim as files beside it, `<STEM>.plan.md` and `<STEM>.lock.md`. Nothing records
  the pairing; the filename does.
- They live on the data branch, never on a code branch: an agent's checkout does not
  contain them. A `tickets` link at the repository root shows them to a person; it is made
  only where nothing exists, and hidden from git.
- `tickets/` holds only open tickets: closing one deletes it, with its plan and its claim.
- No issue tracker is required. A ticket may carry a `GitHub:` line; importing issues
  into tickets is the caller's job, not the skill's.

## Flow: a claim
- A claim is a committed file, `CLAIMED: <holder>`, not something a process remembers:
  the holder may be on another machine, or in a session whose process is gone.
- One holder at a time. A claim lifts only when its holder releases it or the ticket is
  closed; there is no timed release.
- The holder is read from where the command runs, never typed: inside an agent's checkout,
  the agent id from the directory name (the branch gets renamed, the directory does not);
  anywhere else, the current branch.
- Claiming to plan skips a ticket that already has a plan; claiming to implement does not.

## The queue
- `TODO_AGENTS.md` at the root of the branch, beside `tickets/`: list items under
  `## Priority N` headings from 10 down to 0, first within a section first taken.
- An entry is text — a prompt for a future agent. A link back to a ticket is one kind of
  text; the queue does not interpret it.
- Done means deleted, never checked off.

## Flow: the command
- A read fetches origin once and reads off it, so a command sees what every writer pushed,
  its own earlier writes included.
- A write is one commit pushed straight to the branch, through a temporary copy (see
  `@gemstack/agent-data`); a repository with no remote is refused.
