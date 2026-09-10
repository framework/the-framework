A library, not a skill: it has no `SKILL.md` and no command. It turns a branch of the project's repository into a file store for everything coding agents share, the way `gh-pages` holds a site: the branch is checked out once under `.branches/`, every write is one sync → apply → commit → push cycle that re-applies the change when the push loses a race, and every read works from anywhere in the repository. In the product the branch is the `agent-data` branch [1], the writers are the daemon, through the branch's checkout [2], and the four skills' commands, one-shot from any clone of an agent [3] or a cloud session [4]; the skills (`branches`, `tickets`, `queue`, `logs`) and the product import this library and never each other. The source lives in `src/`, whose `LOGIC.md` tells the story file by file. `package.json` and the `tsconfig*.json` files configure the build and carry no business logic; `DECISIONS.md` records the human decisions behind the package.

## Context

**User story**: the user registers a project and, from then on, every machine and cloud session working it shares one set of tickets, one agent queue and one record of runs; nothing of that ever appears as a commit on a code branch, as a change to a tracked file, or as a diff in the user's own checkout.

**Problem**: several writers push one branch with no coordinator, and a hung git call would hold the daemon.

## Glossary

[1] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks. Born as an orphan, written through one sync → commit → push cycle.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. Also "the `agent-data` branch's checkout".
[3] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[4] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.

## Business logic — TL;DR

- **A branch used as a file store** (`src/`, `src/file-branch.ts`) - checked out at `.branches/<branch>` and hidden from git, born an orphan or adopted from origin, written one cycle at a time (sync, apply, commit, push) with the change re-applied when the push loses a race and the remote winning a conflict, never force-pushed, pulled on the daemon's clock, read from anywhere without ever failing, and written one-shot from any clone through a throwaway checkout.
- **Git within a time budget** (`src/git.ts`) - every git call gets 10, 30 or 120 seconds by subcommand; a timeout is its own failure kind; a failure is summarized by git's own reason line.
- **Nothing tracked ever changes** (`src/git-exclude.ts`, `src/names.ts`) - the checkouts directory `.branches` is hidden through git's own `info/exclude`, written once for every worktree; the two names, `.branches` and `agent-data`, are spelled once for every consumer.
- **What consumers import** (`src/index.ts`) - the one entry point of the library, plus a `names` entry point for browser code.
- **Proven against real repositories** (`src/file-branch.test.ts`, `src/git.test.ts`) - the whole life of the branch, and the budgets and failure readings of the git runner.
