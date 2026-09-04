Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating.

## The tickets
- A ticket is a markdown file in `tickets/`. Its plan, and its claim (who is working on
  it), are two more files beside it: the ticket's name with `.md` swapped for `.plan.md`
  and `.lock.md`.
- Tickets live on `agent-data`, the shared data branch named by `@gemstack/agent-data`,
  never on a code branch: no code checkout carries them. On its sync, the program that
  keeps the branch checked out links `tickets` at the project root to
  `.branches/agent-data/tickets` in the branch's persistent checkout, and only if nothing
  of that name is there. The same sync seeds an empty `TODO_AGENTS.md` on a branch born
  without one, so a reader finds a file rather than nothing. Git is told to ignore the
  link with a pair of rules, `/tickets` then `!/tickets/`: the first hides any root entry
  of that name, the second un-hides it again if it is a directory, which a symlink never
  is. The pair is needed because `.git/info/exclude` is one file for every worktree of the
  repository, the data branch's checkout included, whose own `tickets/` folder must stay
  committable.
- `tickets/` holds only open tickets: closing one deletes it, with its plan and its claim.
- `list` answers newest ticket first, dated by the `<DATE>_` its filename carries. A
  filename with no date falls back to the file's modification time; `list` reads off git,
  which has none, so such a ticket is dated the epoch and sorts last.
- The skill knows no issue tracker: a ticket may carry a `GitHub:` line with its issue,
  but importing issues is the program's job.

## Flow: a claim
- A claim is a committed file holding one line, `CLAIMED: <who>`, so that agents on other
  machines see it too.
- One claim per ticket; it never expires: it lifts when the ticket is released or closed,
  and otherwise only by hand on the branch. The command acts under its own holder: it
  releases only its own lock, and closes any ticket nobody else has locked; the program
  that started an agent releases what it left claimed, either naming the holder it expects
  or naming none, which frees whoever holds the lock.
- Releasing a ticket nobody holds is a refusal, not a no-op: a release that lifts nothing
  means the claim is not where the caller thought it was.
- A lock is written only by a claim.
- A claim the program's write cycle committed but could not push still counts as claimed:
  the commit already guards this machine's readers, and the gap is logged. A cycle that
  could not commit at all claims nothing.
- A claim guards planning and working, not writing: `put` overwrites a ticket or its plan
  no matter who holds it, so an import can refresh a ticket someone is working.
- A claim on a ticket the same holder already holds succeeds and writes nothing: a re-run
  after a lost race must not read its own lock as someone else's.
- The holder's name is never typed; the command reads it from where it runs: `AGENT_ID`
  from the environment when the program that started the agent set it, else the current
  branch. The id wins because it outlives the branch: a program that renames an agent's
  branch mid-session leaves a lock naming a branch no live agent answers to. A checkout on
  no branch is refused rather than claiming as `HEAD`. Reading the id off the checkout's
  folder name was dropped: that layout belongs to whichever program made the checkout, not
  to this skill.
- The program says whether a claim is for planning or for implementing: a claim for
  planning is skipped, no lock written, when the ticket already has a plan; a claim for
  implementing is not skipped for having a plan: the plan is what it came to implement;
  only someone else's lock stands in its way. The command always claims to implement.
- The lock's existence is the claim; the holder it names is only shown. A lock nobody can
  read still holds the ticket, and no command lifts it: it goes by hand on the branch.

## The queue
- The queue is one markdown file on the branch, `TODO_AGENTS.md`: sections `## Priority
  10` down to `## Priority 0`, an entry a list item under one of them. The file is kept
  sorted high to low as entries are placed; nothing re-sorts on read, so a reader answers
  in file order, top first.
- An entry is plain text: the task a future agent is started with. `--ticket` writes it as
  a markdown link to the ticket; the ticket is read once as the entry is added, for its
  priority and to refuse an entry pointing at no ticket. The queue file knows nothing of
  tickets: it holds lines, places them and removes them. The program that starts agents
  reads that link back, to claim the ticket for the agent it starts on the entry.
- An entry added with no priority is appended at the end of the file, so it lands in
  whatever section ends it; one linked to a ticket takes the ticket's priority, 5 when the
  ticket has none or names one that is not a whole 0-10: clamping a typo would claim 10 or
  0, both reserved ends of the scale. A priority the file has no section for gets one,
  placed before the first lower section so the file stays sorted high to low. A file with
  no priority section at all gets the new one above its first `## ` section, so an
  unranked section cannot bury a deliberate one; a file with no `## ` section at all gets
  it appended at the end. An entry joins the end of its section.
- Done means deleted, never checked off: a `- [x]` line is not an open entry, and `queue`
  never lists it.

## Flow: the command
- The command reads with `list`, `show` and `queue`, and writes with `put` (a ticket, a
  plan, or `meta.json`; the bytes as given, unparsed), `close`, `claim`, `release`, `queue
  add` and `queue done`.
- The only thing read out of `meta.json` is the last-import stamp the importing program
  keeps there.
- A read fetches the branch from origin once and reads everything from that copy: only
  origin is sure to hold what every writer pushed, the command's own earlier writes
  included. With no origin, the local branch is read instead: writes are refused there, so
  nobody else can have moved it.
- One JSON document on stdout for every command that runs: the result, or the refusal. A
  refusal, a rule saying no, adds one line for a person on stderr and exits 1; an argument
  that cannot be read never gets that far: the usage on stderr, nothing on stdout, exit 2.
  A malformed command line (an unknown flag, the wrong argument count, a `--priority` off
  the 0-10 scale) is that usage error; an argument that parses but names a file no command
  may touch is an ordinary refusal, `invalid-path`.
- Anything a command throws is reported like a refusal, reason `git-failed`, with the
  error's own line on stderr: a caller parsing stdout never has to handle a command that
  printed nothing.
- `list` and `queue` answer with a bare JSON array when they run; every other result, and
  every refusal, is an object whose `ok` tells the two apart.
- Run outside a repository, a command refuses with `not-a-repo`: only git's own "not a git
  repository" reads as that, every other git failure stays `git-failed`.
- A write is one commit per command, pushed straight to origin through a throwaway
  worktree at origin's tip; a push that loses a race is re-applied on the new tip by
  `@gemstack/agent-data`. A repository with no remote is refused.
- `queue done` takes the entry as `queue` printed it and refuses a line the queue does not
  have.
