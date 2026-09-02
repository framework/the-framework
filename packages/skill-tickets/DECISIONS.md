Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating.

## The tickets
- A ticket is a markdown file in `tickets/`. Its plan, and its claim (who is working on
  it), are two more files beside it with the same name plus `.plan.md` and `.lock.md`.
  The shared name is the only link between them.
- Tickets live on the data branch of `@gemstack/agent-data`, never on a code branch: an
  agent's checkout has no `tickets/` folder, and a pull request never carries a ticket.
  For a person, a `tickets` shortcut at the project root points into the data branch's
  checkout; it is created only if nothing of that name is there, and git is told to
  ignore it.
- `tickets/` holds only open tickets: closing one deletes it, with its plan and its claim.
- The skill knows no issue tracker. A ticket may carry a `GitHub:` line with its issue,
  but importing issues into tickets is done by the program using the skill, not by the
  skill.

## Flow: a claim
- A claim is a committed file holding one line, `CLAIMED: <who>`, so that agents on other
  machines see it too.
- One claim per ticket; it never expires, only a release, or a close by whoever holds it,
  removes it. Whoever started an agent releases what it left claimed.
- A lock is written only by a claim; `put` refuses `.lock.md`.
- The holder's name is never typed; the command reads it from where it runs. Inside an
  agent's checkout it is the agent id from the folder name, since the branch gets renamed
  and the folder does not; anywhere else it is the current branch.
- The program says what a claim is for. A claim for planning is skipped, no lock written,
  when the ticket already has a plan; a claim for implementing is not.

## The queue
- The queue is one markdown file on the branch, `TODO_AGENTS.md`: sections `## Priority
  10` down to `## Priority 0`, an entry a list item under one of them. Work is taken
  from the top: highest section first, first line first.
- An entry is plain text: the task a future agent is started with. It may be a link to a
  ticket, but the queue does not read links; it only stores and removes lines. The
  program that starts agents reads the link, to claim the ticket for the agent it starts
  on that entry.
- Done means deleted, never checked off.

## Flow: the command
- The command reads with `list`, `show` and `queue`, and writes with `put` (a ticket, a
  plan, or the importing program's `meta.json`), `close`, `claim`, `release`, `queue add`
  and `queue done`.
- A read fetches the branch from origin, the shared copy on the remote, once, and reads
  everything from that copy rather than from the local branch: only origin is sure to
  hold what every writer pushed, the command's own earlier writes included.
- A write is one commit per command, pushed straight to origin through a temporary copy
  of the branch (the rule is in `@gemstack/agent-data`). A repository with no remote is
  refused.
