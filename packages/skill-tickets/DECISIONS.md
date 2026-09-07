Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating.

A bullet is a person's pick, and says what it was picked over. What the code does belongs
in SPEC.md; a choice made while implementing is the implementer's judgment, not a
decision. An AI proposes a bullet and asks; it never adds or rewrites one.

## The tickets
- Two callers: the command an agent runs, and a long-lived program that keeps the branch
  checked out, starts agents through the library, and imports issues with its own code,
  stamping `meta.json`. The executable is `tickets`. The package ships `SKILL.md`, the
  agent's instructions.
- A ticket is a markdown file in `tickets/`. Its plan and its claim sit beside it:
  `<name>.plan.md` and `<name>.lock.md`, `<name>` the filename without `.md`.
- Tickets live on `agent-data`, the branch `@gemstack/agent-data` names, never on a code
  branch. The program links `tickets` at the project root to the relative target
  `.branches/agent-data/tickets`, only when nothing of that name sits at the root; the
  target may not exist yet, so the link dangles until the first ticket lands. The link is
  hidden by two rules in `.git/info/exclude`, `/tickets` then `!/tickets/`. `/tickets`
  hides the link, `!/tickets/` re-admits directories, which a symlink is not, so the
  persistent checkout still commits its own `tickets/` under the same repo-wide exclude.
- Closing a ticket deletes it, its plan and its claim, and nothing else; a queue entry
  linking it stays until `queue done`.
- A ticket's row, the same fields in `list` and `show`: the title from its `# ` line, the
  summary from the first prose line after `## TLDR`, else after the title, scanning past
  headings to the end of the file, `Priority:` verbatim.

## Flow: a claim
- A claim is a committed file holding one line, `CLAIMED: <who>`, so agents on other
  machines see it.
- One claim per ticket; it never expires: it lifts when the ticket is released or closed,
  otherwise only by hand on the branch. The command lifts only its own lock, and closes
  only when the ticket has no lock or its own, `not-holder` otherwise. Releasing an
  unclaimed ticket is a refusal.
- A lock is written only by a claim; someone else's `claim` is refused while it exists.
  `put` ignores it, so an import can refresh a ticket someone holds.
- A claim the program committed but could not push still counts: the commit already guards
  this machine's readers, and the gap is logged. A cycle that could not commit claims
  nothing. The program's release is judged the same way: committed counts, pushed or not.
  A queue edit is not: it counts only once pushed.
- Claiming a ticket you already hold succeeds and writes nothing, so a re-run does not
  read its own lock as someone else's.
- The holder is never typed: `AGENT_ID` when non-blank, else the current branch. The id
  outlives the branch: a rename mid-session would leave a lock naming a branch nobody
  answers to. A checkout on no branch is refused, never claimed as `HEAD`. The checkout's
  folder name is not read: the layout is the caller's.
- The program says whether a claim is for planning or implementing: a claim for planning
  is skipped, no lock written, when the ticket already has a plan, unless the lock is
  already this holder's; a claim for implementing ignores the plan; only someone else's
  lock stands in its way. The command always claims to implement.
- The lock's existence is the claim: the holder it names decides who may close or release,
  not whether the ticket counts as locked.

## The queue
- The queue is one markdown file on the branch, `TODO_AGENTS.md`: sections `## Priority
  10` down to `## Priority 0`, any `## Priority N` counts, in any case; any `-`, `*` or
  `N.` list item with text is an entry, wherever it sits. Entries are placed to keep the
  file sorted high to low; nothing re-sorts on read.
- An entry is plain trimmed text: the task a future agent is started with. `--ticket`
  writes the entry as a markdown link to the ticket, the given text as its label; the
  program reads the link back to claim the ticket for the agent it starts.
- `queue add` creates the queue file when the branch has none. An entry with no priority
  goes at the end of the file, in whatever section ends it; one linked to a ticket takes
  the ticket's priority unless `--priority` was given; a ticket whose `Priority:` is
  missing or unreadable counts as 5, never 10 or 0: those ends (act immediately, only if
  capacity) are deliberate picks.
- Done means deleted, never checked off: a `- [x]` or `- [X]` line is not an open entry; a
  `- [ ]` line is, printed without its box and deleted whole.

## Flow: the command
- Every command names a ticket by its bare filename or its `tickets/<file>` path, so a
  queue entry's link target can be pasted in as is; a sibling's name (`.plan.md`,
  `.lock.md`) is `invalid-path` to every command, `put` taking `.plan.md` the one
  exception.
- No command reads `meta.json`: only the importing program does, for its one key
  `lastImportedAt`.
- A read fetches origin once and reads everything from that copy (the library's queue read
  fetches only when asked): only origin has every writer's pushes, this command's own
  included. With no origin the local branch is read: writes are refused there, so nobody
  else can have moved it.
- Every command that runs prints one JSON document, the result or the refusal. A refusal
  also puts one line on stderr and exits 1. A malformed command line (an unknown flag, the
  wrong argument count, an empty `queue add` text, a `--priority` off the 0-10 scale) is
  rejected first: the usage on stderr, nothing on stdout, exit 2. A file no command may
  touch refuses with `invalid-path`. Anything a command throws refuses with `git-failed`.
  Outside a repository a command refuses `not-a-repo`; only git's own "not a git
  repository" reads as that.
- `list` and a bare `queue` answer with a JSON array; every other result and every refusal
  is an object with `ok`.
- The command's write is one commit per command, pushed straight to origin through a
  throwaway worktree at origin's tip; a push that loses a race is re-applied on the new
  tip by `@gemstack/agent-data`. The program's writes go through its persistent checkout's
  cycle instead; its `queue done` of an entry already gone succeeds, changing nothing.
- `queue done` takes the entry as `queue` printed it, trimmed, removes the first such
  line, and refuses a line the queue does not have, an empty one included, decided inside
  the write.
