Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating. Keep
outdated decisions (no history).

A bullet is a person's pick, and says what it was picked over. What the code does belongs
in SPEC.md; a choice made while implementing is the implementer's judgment, not a
decision. An AI proposes a bullet and asks; it never adds or rewrites one.

## The queue
- Two callers: the command an agent runs, and a long-lived program that keeps the branch
  checked out and drains the queue through this package's functions. The executable is
  `queue`. The package ships `SKILL.md`, the agent's instructions.
- The queue is one markdown file on the branch, `TODO_AGENTS.md`: sections `## Priority
  10` down to `## Priority 0`, any `## Priority N` counts, in any case; any `-`, `*` or
  `N.` list item with text is an entry, wherever it sits. Entries are placed to keep the
  file sorted high to low; nothing re-sorts on read.
- An entry is plain trimmed text: the task a future agent is started with. The package
  does not know tickets: a caller that queues a ticket writes the entry itself as a
  markdown link to the ticket, and reads the link back to claim the ticket for the agent
  it starts. No `--ticket` flag on the command.
- `queue add` creates the queue file when the branch has none. An entry with no priority
  goes at the end of the file, in whatever section ends it.
- Done means deleted, never checked off: a `- [x]` or `- [X]` line is not an open entry; a
  `- [ ]` line is, printed without its box and deleted whole.

## Flow: the command
- A read fetches origin once and reads everything from that copy (the library's queue read
  fetches only when asked): only origin has every writer's pushes, this command's own
  included. With no origin the local branch is read: writes are refused there, so nobody
  else can have moved it.
- Every command that runs prints one JSON document, the result or the refusal. A refusal
  also puts one line on stderr and exits 1. A malformed command line (an unknown flag, the
  wrong argument count, an empty `queue add` text, a `--priority` off the 0-10 scale) is
  rejected first: the usage on stderr, nothing on stdout, exit 2. Anything a command
  throws refuses with `git-failed`. Outside a repository a command refuses `not-a-repo`;
  only git's own "not a git repository" reads as that.
- A bare `queue` answers with a JSON array; every other result and every refusal is an
  object with `ok`.
- The command's write is one commit per command, pushed straight to origin through a
  throwaway worktree at origin's tip; a push that loses a race is re-applied on the new
  tip by `@gemstack/agent-data`. The program's writes go through its persistent checkout's
  cycle instead; its `queue done` of an entry already gone succeeds, changing nothing. A
  program's queue edit counts only once pushed.
- `queue done` takes the entry as `queue` printed it, trimmed, removes the first such
  line, and refuses a line the queue does not have, an empty one included, decided inside
  the write.
