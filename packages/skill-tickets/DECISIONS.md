Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating.

## The tickets
- A ticket is a markdown file in `tickets/`. Its plan, and its claim (who is working on
  it), are two more files beside it: the ticket's name with `.md` swapped for `.plan.md`
  and `.lock.md`.
- Tickets live on `agent-data`, the shared data branch named by `@gemstack/agent-data`,
  never on a code branch: an agent's checkout has no `tickets/` folder, and a pull request
  never carries a ticket. For a person, the program that keeps the branch checked out
  links `tickets` at the project root into the branch's persistent checkout,
  `.branches/agent-data`, and only if nothing of that name is there. Git is told to ignore
  it with two rules: `/tickets` hides root entries of that name, and `!/tickets/`
  re-includes directories, which a link never is. Both are needed because the exclude file
  speaks for the data branch's checkout too, whose real `tickets/` folder must keep
  committing.
- `tickets/` holds only open tickets: closing one deletes it, with its plan and its claim.
- `list` answers newest ticket first, dated by the `<DATE>_` its filename carries; a
  ticket without one has no date a branch read can give it, and sorts last.
- The skill knows no issue tracker. A ticket may carry a `GitHub:` line with its issue,
  but importing issues into tickets is done by the program using the skill, not by the
  skill.

## Flow: a claim
- A claim is a committed file holding one line, `CLAIMED: <who>`, so that agents on other
  machines see it too.
- One claim per ticket; it never expires: only its holder lifts it, by releasing the
  ticket or by closing it. The program that started an agent releases what it left
  claimed.
- A lock is written only by a claim; `put` refuses `.lock.md`.
- A claim guards planning and working, not writing: `put` overwrites a ticket or its plan
  no matter who holds it, so an import can refresh a ticket someone is working.
- A claim on a ticket the same holder already holds succeeds and writes nothing: a re-run
  after a lost race must not read its own lock as someone else's.
- The holder's name is never typed; the command reads it from where it runs: `AGENT_ID`
  from the environment when the program that started the agent set it, else the current
  branch. The id wins because it outlives the branch, which that program renames once the
  agent names its session. A checkout on no branch is refused rather than claiming as
  `HEAD`. Reading the id off the checkout's folder name was dropped: that layout belongs
  to whichever program made the checkout, not to this skill.
- The program says what a claim is for. A claim for planning is skipped, no lock written,
  when the ticket already has a plan; a claim for implementing is not. The command always
  claims to implement: `claim` never skips a planned ticket.

## The queue
- The queue is one markdown file on the branch, `TODO_AGENTS.md`: sections `## Priority
  10` down to `## Priority 0`, an entry a list item under one of them. Work is taken from
  the top: highest section first, first line first.
- An entry is plain text: the task a future agent is started with. `--ticket` writes it as
  a markdown link to the ticket, resolved once when the entry is added; the queue itself
  only stores and removes lines. The program that starts agents reads that link back, to
  claim the ticket for the agent it starts on the entry.
- An entry added with no priority goes to the end of the file; one linked to a ticket
  takes the ticket's priority, 5 when the ticket has none or names one that is not a whole
  0-10: clamping a typo would claim 10 or 0, both reserved ends of the scale. A priority
  the file has no section for gets one, placed before the first lower section so the file
  stays sorted high to low.
- Done means deleted, never checked off.

## Flow: the command
- The command reads with `list`, `show` and `queue`, and writes with `put` (a ticket, a
  plan, or `meta.json`; the bytes as given, unparsed), `close`, `claim`, `release`, `queue
  add` and `queue done`.
- Nothing is ever read back out of `meta.json` but the last-import stamp the importing
  program keeps there.
- A read fetches the branch from origin once and reads everything from that copy: only
  origin is sure to hold what every writer pushed, the command's own earlier writes
  included. With no origin, the local branch is read instead; a read has nothing to lose
  by it.
- One JSON document on stdout for every command that runs: the result, or the refusal. A
  refusal, a rule saying no, adds one line for a person on stderr and exits 1; an argument
  that cannot be read never gets that far: the usage on stderr, nothing on stdout, exit 2.
- A git failure past the decision is reported like a refusal, reason `git-failed`, with
  git's own line on stderr: a caller parsing stdout never has to handle a command that
  printed nothing.
- A write is one commit per command, pushed straight to origin through a throwaway
  worktree at origin's tip; a push that loses a race is re-applied on the new tip by
  `@gemstack/agent-data`. A repository with no remote is refused.
- `queue done` takes the entry as `queue` printed it and refuses a line the queue does not
  have.
