Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating.

## The tickets
- A ticket is a markdown file; its plan and its claim are files beside it, same name plus
  `.plan.md` and `.lock.md`. The name is the only link between them.
- They live on the data branch, never on a code branch: an agent's checkout does not
  contain them. A `tickets` link at the repository root shows them to a person; it is made
  only where nothing exists, and hidden from git.
- `tickets/` holds only open tickets: closing one deletes it, with its plan and its claim.
- The skill knows no issue tracker. A ticket may carry a `GitHub:` line with its issue,
  but importing issues into tickets is done by the program using the skill, not by the
  skill.

## Flow: a claim
- A claim is a committed file, `CLAIMED: <holder>`: agents on other machines must see it
  too.
- One claim per ticket; it never expires, only a release or a close removes it.
- The holder's name is never typed; the command reads it from where it runs. Inside an
  agent's checkout it is the agent id from the folder name, since the branch gets renamed
  and the folder does not; anywhere else it is the current branch.
- Claiming to plan skips a ticket that already has a plan; claiming to implement does not.

## The queue
- The queue is one markdown file on the branch, `TODO_AGENTS.md`: sections `## Priority
  10` down to `## Priority 0`, an entry a list item under one of them. Work is taken
  from the top: highest section first, first line first.
- An entry is plain text: the task a future agent is started with. It may be a link to a
  ticket, but the queue does not read links; it only stores and removes lines. The
  tickets side reads the link.
- Done means deleted, never checked off.

## Flow: the command
- A read fetches the branch from origin once and reads everything from that copy, not
  from the local branch: only origin is sure to hold what every writer pushed, the
  command's own earlier writes included.
- A write is one commit per command, pushed straight to origin through a temporary copy
  of the branch (the rule is in `@gemstack/agent-data`). A repository with no remote is
  refused.
