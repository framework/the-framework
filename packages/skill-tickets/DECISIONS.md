Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating.

## The tickets
- Two users: the command an agent runs, and a long-lived program that keeps the branch
  checked out, imports issues and starts agents through the package's library. The package
  ships `SKILL.md`, the agent's instructions, with the ticket, plan and queue formats the
  code parses.
- A ticket is a markdown file in `tickets/`. Its plan and its claim (who is working on it)
  are two more files beside it: the name with `.md` swapped for `.plan.md` and `.lock.md`.
- Tickets live on `agent-data`, the shared data branch named by `@gemstack/agent-data`,
  never on a code branch. The program's sync seeds an empty `TODO_AGENTS.md` when the
  branch has none, so the queue is a file before its first entry; then links `tickets` at
  the project root to `.branches/agent-data/tickets`, a relative target, where nothing of
  that name sits; then converges the checkout with origin. A seed that cannot commit stops
  before the link; a link that cannot be made is ignored, and the sync still reports the
  pull. The link is hidden, when it is made, by two rules, `/tickets`
  then `!/tickets/`: the first hides any root entry of that
  name, the second un-hides directories, which a symlink is not; two because
  `.git/info/exclude` is one file for every worktree, the data branch's checkout included,
  whose own `tickets/` must stay committable.
- `tickets/` holds only open tickets: closing one deletes it, its plan and its claim, and
  nothing else; a queue entry linking it stays until `queue done`.
- `list` answers newest first by the `<DATE>_` in the filename, ties by filename
  ascending. A filename with no date falls back to the file's modification time; a read
  off git has none, so the ticket is dated the epoch and sorts last.
- A ticket's row, from `list` and `show` alike: the title from its `# ` line, the summary
  from the first prose line after `## TLDR`, else after the title (a `Source:` line
  skipped), `Topics: [a, b]` split into tags, `GitHub:` into label and url, `Priority:`
  verbatim, whether a plan and a lock sit beside it and whom the lock names, and the
  plan's `Effort:` and `Uncertainty:`, read as absent outside a whole number 0-10. Keys
  and headings match in any case, and keys are read only above the `# ` title. `list`
  reads the first 4 KB of a ticket, `show` all of it.
- The package knows no issue tracker: a ticket may carry a `GitHub:` line, but importing
  issues is the program's job.

## Flow: a claim
- A claim is a committed file holding one line, `CLAIMED: <who>`, so agents on other
  machines see it.
- One claim per ticket; it never expires: it lifts when the ticket is released or closed,
  otherwise only by hand on the branch. The command lifts only a lock naming the holder it
  reads, and closes only when the ticket has no lock or its own. The program that started
  an agent releases what the agent left claimed, naming the holder it expects or none;
  none frees whoever holds the lock.
- Releasing a ticket nobody holds is a refusal, not a no-op.
- A lock is written only by a claim, and it gates a second `claim`, `close` and `release`,
  not `put`. `put` ignores it, so an import can refresh a ticket someone is working.
- A claim the program's write cycle committed but could not push still counts: the commit
  already guards this machine's readers, and the gap goes to the program's log. A cycle
  that could not commit claims nothing.
- Claiming a ticket you already hold succeeds and writes nothing: a re-run
  after a lost race must not read its own lock as someone else's.
- The holder's name is never typed: the command reads `AGENT_ID` from the environment when
  it is non-blank, else the current branch. The id outlives the
  branch: a rename mid-session would leave a lock naming a branch nobody
  answers to. A checkout on no branch is refused rather than claiming as `HEAD`. The
  checkout's folder name is not read: the layout is the caller's.
- The program says whether a claim is for planning or implementing: a claim for planning
  is skipped, no lock written, when the ticket already has a plan; a claim for
  implementing wants that plan, so only someone else's lock stands in its way. The command
  always claims to implement. The program's claim writes the lock without reading the
  ticket, so a ticket closed under it gets an orphan lock.
- The lock's existence is the claim; the holder it names is only shown. A lock whose line
  does not parse still holds the ticket, and no command lifts it: only the program's
  release naming no holder, or a hand edit on the branch. A lock file that cannot be read
  at all is treated as absent, and the next claim overwrites it.

## The queue
- The queue is one markdown file on the branch, `TODO_AGENTS.md`: sections `## Priority
  10` down to `## Priority 0`, any `## Priority N` of one or two digits counts; any `-`,
  `*` or `N.` list item in the file is an entry, wherever it sits. Entries are placed so
  the file stays sorted high to low; nothing re-sorts on read, so a reader answers in file
  order.
- An entry is plain text, trimmed: the task a future agent is started with. `--ticket` writes it as
  a markdown link to the ticket, read as the entry is added, for its priority and to
  refuse an entry pointing at no ticket; the program reads the link back to claim the
  ticket for the agent it starts.
- An entry added with no priority is appended at the end of the file, in whatever section
  ends it; one linked to a ticket takes the ticket's priority unless one was given, and 5
  when the ticket has none or names one that is not a whole number 0-10: clamping a typo
  would claim 10 (act immediately) or 0 (only if capacity), the reserved ends. A priority
  the file has no section for gets one, before the first lower section, so the file stays
  sorted, or after the last priority section when none is lower; a file with no priority
  section gets it above its first `## ` section, so an unranked section cannot bury a
  deliberate one; a file with no `## ` section gets it appended. An entry joins the end of
  its section.
- Done means deleted, never checked off: a `- [x]` line is not an open entry, and `queue`
  never lists it; a `- [ ]` line is one, printed and removed without its box.

## Flow: the command
- The command reads with `list`, `show` and `queue`, and writes with `put` (a ticket, a
  plan, or `meta.json`, all inside `tickets/`; the bytes as given, unparsed), `close`, `claim`, `release`, `queue
  add` and `queue done`.
- `show` answers with the ticket's row, its text, its plan and its holder. `show`, `claim`
  and `close` refuse a ticket that is not there, `no-ticket`; `claim` and `close` check
  inside the write, so without an origin their refusal is `no-remote`; `release` goes
  through the write too but looks only at the lock, so an orphan lock naming you lifts;
  `claim`, `close` and `release` read the holder after the filename check, so a checkout on
  no branch answers `no-identity` next; `put` checks only the name, so a
  plan can be written for a ticket that does not exist.
- A ticket is named to any command by its bare filename or by its `tickets/<file>` path,
  so the target of the link a queue entry carries can be pasted straight in.
- No command reads `meta.json`: the importing program is its only reader, for the one key
  it keeps there, `lastImportedAt`; a file that does not parse to that reads as no stamp.
- A read fetches the branch from origin once and reads everything from that copy: only
  origin has every writer's pushes, this command's own included.
  With no origin the local branch is read: writes are refused there, so nobody else can
  have moved it.
- Every command that runs prints one JSON document, the result or the refusal; a refusal
  also prints one line on stderr and exits 1. A malformed
  command line (an unknown flag, the wrong argument count, an empty `queue add` text, a
  `--priority` off the 0-10 scale) never gets that far: the usage on stderr, nothing on
  stdout, exit 2. An argument that parses but names a file no command may touch is an
  ordinary refusal, `invalid-path`.
- Anything a command throws is reported as a refusal with reason `git-failed`.
- `list`, and `queue` with no sub-command, answer with a bare JSON array; every other
  result, and every refusal, is an object whose `ok` tells the two apart.
- Run outside a repository, a command refuses with `not-a-repo`: only git's own "not a git
  repository" reads as that, every other git failure stays `git-failed`.
- The refusals: `no-ticket`, `claimed` (with the holder, when readable), `not-holder`,
  `no-lock`, `no-entry`, `no-identity`, `no-remote`, `invalid-path`, `not-a-repo`,
  `git-failed`.
- A write is one commit per command, pushed straight to origin through a throwaway
  worktree at origin's tip; a push that loses a race is re-applied on the new tip by
  `@gemstack/agent-data`.
- `queue done` takes the entry as `queue` printed it, trimmed, removes the first such line,
  and refuses a line the queue does not have, an empty one included.
