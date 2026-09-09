Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating. Keep
outdated decisions (no history).

A bullet is a person's pick, and says what it was picked over. What the code does belongs
in SPEC.md; a choice made while implementing is the implementer's judgment, not a
decision. An AI proposes a bullet and asks; it never adds or rewrites one.

## The tickets
- Two callers: the command an agent runs, and a long-lived program that keeps the branch
  checked out, starts agents through this package's functions, and imports issues with its
  own code, stamping `meta.json`. The executable is `tickets`. The package ships
  `SKILL.md`, the agent's instructions.
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
  headings, `Priority:` lowercased.

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
  this machine's readers, and the gap is logged. A write that could not commit claims
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

## Flow: queueing a ticket
- The package never reads or writes the queue. A ticket is queued by the caller as a
  markdown link to the ticket, the title as its label; the program reads the link back to
  claim the ticket for the agent it starts. The entry takes the ticket's priority; a
  ticket whose `Priority:` is missing or unreadable counts as 5, never 10 or 0: those ends
  (act immediately, only if capacity) are deliberate picks.

## Flow: the command
- Every command names a ticket by its bare filename or its `tickets/<file>` path, so a
  queue entry's link target can be pasted in as is; a sibling's name (`.plan.md`,
  `.lock.md`) is `invalid-path` to every command, `put` taking `.plan.md` and `meta.json`
  the exceptions.
- No command reads `meta.json`: only the importing program does, for its one key
  `lastImportedAt`.
- A read fetches origin once and reads everything from that copy: only origin has every
  writer's pushes, this command's own included. With no origin the local branch is read:
  writes are refused there, so nobody else can have moved it.
- Every command that runs prints one JSON document, the result or the refusal. A refusal
  also puts one line on stderr and exits 1. A malformed command line (an unknown flag, the
  wrong argument count) is rejected first: the usage on stderr, nothing on stdout, exit 2.
  A file no command may touch refuses with `invalid-path`. Anything a command throws
  refuses with `git-failed`. Outside a repository a command refuses `not-a-repo`; only
  git's own "not a git repository" reads as that.
- `list` answers with a JSON array; every other result and every refusal is an object with
  `ok`.
- The command's write is one commit per command, pushed straight to origin through a
  throwaway worktree at origin's tip; a push that loses a race is re-applied on the new
  tip by `@gemstack/agent-data`. The program's writes go through its persistent checkout's
  cycle instead.
