The `queue` command: the three operations an agent [1], or a person in a shell, runs from any checkout [2] of the repository over the agent queue [3] on the `agent-data` branch [4]: the bare `queue` to read it, `queue add` to put an entry on it, `queue done` to take one off. Reads come off origin's copy of the branch, fetched first; each write is one commit made on a throwaway checkout of origin's tip and pushed straight to the branch; every command answers with one JSON document on stdout, one line for a person on stderr, and an exit code that says how it went.

## Context

**User story**: an agent [1] in its own checkout [2] on a code branch reads what agents will work next, queues a task it discovered or a ticket it wrote, and removes the entry it just finished; the user can do the same from a shell. The agent's checkout holds no copy of the `agent-data` branch [4], so the command reaches the branch through origin, and what it changes is visible to every other machine at once.

**Business logic story**: which lines are entries and where an entry lands are the rules of `queue.ts`; the branch reader and the detached writer, including a rejected push re-applied on origin's new tip, are the `agent-data` package's. The persistent checkout the daemon keeps (`store.ts`) is never touched by the command.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the user's checkout".
[3] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[4] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[5] queue entry: an item on the agent queue.

## Business logic — TL;DR

- **The contract: JSON out, a line for a person, an exit code** - every command prints one JSON document on stdout; a refusal adds one line on stderr and exits 1; a command line that cannot be read prints the usage on stderr, nothing on stdout, and exits 2; anything else that fails exits 1 as `git-failed`.
- **The bare command reads the queue off origin** - `queue` alone answers the open entries in order of work as one JSON array, fetched from origin; with no origin the local branch is read; a branch with no queue answers an empty array; outside a repository every command refuses `not-a-repo`.
- **Writes are one pushed commit each, on a throwaway checkout** - `add` and `done` each make one commit on a throwaway checkout of origin's tip and push it straight to the branch; nothing lands in the caller's checkout; with no remote the write is refused as `no-remote`.
- **`queue add`** - puts the trimmed text on the queue, in its `## Priority N` section when `--priority` is given (0 to 10, else a usage error), at the end of the file otherwise, creating the queue file when the branch has none; an empty text is a usage error.
- **`queue done`** - removes the first open entry whose text is exactly the argument, trimmed; an entry the queue does not have is refused as `no-entry`, decided inside the write.

## Business logic

### The contract: JSON out, a line for a person, an exit code

#### Context

**Problem**: the same output is read by two readers at once, a program parsing it (an agent, the daemon) and a person watching the shell; each needs its own channel, and the exit code has to tell a rule saying no from a broken environment.

#### Business logic

The command is `queue [command]`; its usage names the bare command, `add` and `done`. Every command that runs prints exactly one JSON document on stdout: the bare command a JSON array, every other result and every refusal an object with `ok`. A result exits 0. A refusal is a rule saying no (there is no such entry): it prints `{"ok":false,"reason":…}` with the reason's details on stdout so a caller parsing the output learns why, one line on stderr so a person does, and exits 1. A malformed command line is rejected before anything else runs: an unknown command, which is also what an argument to the bare command is, prints the usage on stderr and exits 2; an unknown flag, the wrong number of arguments (`add` and `done` take exactly one), an empty or blank `add` text ("the entry is empty") or a `--priority` off the scale ("--priority takes 0 to 10, got <value>") prints what was wrong followed by the usage, nothing on stdout, and exits 2, writing nothing. Anything else that fails, git timing out, git missing, a corrupt repository, prints `{"ok":false,"reason":"git-failed","detail":…}` with git's own explanation as the detail, the same detail on stderr, and exits 1. Only git's own "not a git repository" is read as being outside a repository, which is a refusal, `not-a-repo`, "not inside a git repository"; every other git error stays the failure it is.

### The bare command reads the queue off origin

#### Context

**Problem**: only origin has every writer's pushes, this command's own earlier writes included, because a write never leaves a copy of the branch in the caller's checkout [2].

#### Business logic

`queue` with no command fetches origin once and reads `TODO_AGENTS.md` from origin's copy of the `agent-data` branch [4], by the `agent-data` package's reader, and answers its open entries in order of work as one JSON array, each queue entry [5] as `queue.ts` reads it (a task box dropped, the text trimmed). A branch with no queue file answers an empty array. With no origin, the local branch is read; writes are refused there, so nobody else can have moved it. Outside a repository, every command refuses `not-a-repo` before touching anything.

### Writes are one pushed commit each, on a throwaway checkout

#### Context

**Problem**: the caller's checkout [2] is on a code branch and must stay untouched, yet two agents can write the queue back to back, so a write must land on origin's newest tip, not on whatever was fetched a moment earlier.

#### Business logic

`add` and `done` each make one write: a throwaway checkout of origin's tip of the `agent-data` branch [4] is made, the change applied to it, committed with the command's own message ("queue add: <entry>", "queue done: <entry>"), and pushed straight to the branch; a push origin rejects because another writer got there first is re-applied on the new tip and pushed again, by the `agent-data` package's rules. Every judgment a write command makes (is the entry there) is therefore made inside the write, against the tip the commit lands on, and a re-applied write judges again. A command whose judgment is a refusal changes nothing, so nothing is committed. The commit is authored as the git user of the checkout the command ran in. Nothing lands in the caller's checkout, which keeps no copy of the branch, and the daemon's persistent checkout is never touched. A repository with no remote has nothing to carry the change: the write is refused as `no-remote`, "the repository has no remote, so nothing can carry the change".

### `queue add`

#### Context

**User story**: an agent [1] queues a task for a future agent as plain text, or a ticket as a markdown link labeled with the ticket's title at the ticket's own priority; the user sees it in the dashboard's queue under that priority.

#### Business logic

`add <text> [--priority N]` puts the text, with surrounding whitespace removed, on the queue as one entry. With `--priority`, the value must be a whole number from 0 to 10, and the entry lands in that `## Priority N` section by the placement rule of `queue.ts`, the section created where the file's order calls for it when there is none. Without `--priority`, the entry is appended at the end of the file, in whatever section ends it. A branch with no queue file gets one, holding the new entry. The write lands as "queue add: <entry>" and answers `{"ok":true,"entry":…}` with `priority` added when one was given.

### `queue done`

#### Context

**User story**: an agent [1] finished a task, or the task is no longer wanted, and takes it off the queue by passing the entry exactly as the bare command printed it; the queue is only the remaining work.

#### Business logic

`done <text>` removes the first open entry whose text is exactly the argument with surrounding whitespace removed, by the removal rule of `queue.ts`, deleting its line rather than checking it off, and answers `{"ok":true,"entry":…}` after the commit "queue done: <entry>". Whether the entry is open is decided inside the write, against the tip the commit lands on: when no open entry reads that way, nothing is written, and the command refuses `no-entry`, `{"ok":false,"reason":"no-entry","entry":…}`, telling the person "no open queue entry reads "<entry>"".
