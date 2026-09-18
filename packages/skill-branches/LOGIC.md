The `branches` skill [1], one of the four skills every agent [2] is taught: one git worktree per agent under the project's `.branches/` directory, the agent's checkout [3], named as its branch and reclaimed [4] once its work is on the remote, and published [7] by the agent itself when it finishes. The package is three things at once: the instructions the agent reads (`SKILL.md`), the `branches` command every agent runs through `npx` (`bin/`, `src/cli.ts`), and the library the scheduler (`agent-scheduler`) calls to make and reclaim checkouts, hold a checkout's merge and release it, and the dashboard's server calls to list, size, reclaim and remove them (`src/`). `package.json` and the `tsconfig*.json` files configure the package, its build and its tests, `dist/` and `dist-test/` are build output, and `DECISIONS.md` records the decisions the code implements; none of them carries business logic of its own.

## Context

**User story**: the user starts agents [2] from the dashboard and each works in a checkout [3] of its own while the user's working copy stays untouched; the agent names its work and the dashboard labels it by that session name [5]; when the agent is done and its work is on the remote, its checkout goes away on its own, and the user never loses work to that removal.

## Glossary

[1] skill: one of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads (its `SKILL.md`, linked into the checkout where the coding agent's harness looks for skills), a command on the agent's PATH, and an API the product calls.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] reclaim: removing a finished agent's checkout once its work is on the remote.
[5] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[6] coding agent: the CLI doing the actual work: Claude Code or Codex.
[7] publish: push a checkout's branch, open its pull request, and arm the merge when the work may land on its own; from a checkout whose merge whoever started the agent holds, the merge is only recorded as wanted and armed at the release.

## Business logic — TL;DR

- **What the agent is told** (`SKILL.md`) - its work goes on `agent-<name>`, named before its first change; it reads and writes only in its checkout [3]; it commits as it goes, finishes only when its checkout is clean, and then publishes [7] its own work, unless whoever started it said they publish for it.
- **The library and the command** (`src/`) - the names, git's worktree mechanism, the checkout sequence, the dependency and skill links, the links under `.branches/`, publishing [7], holding and releasing a merge, reclaiming [4], and the `branches` command over all of it.
- **The executable** (`bin/`) - the `branches` file the package registers as the command.
- **How an agent gets the skill** - the instructions, the command and the library meet in every checkout.

## Business logic

### How an agent gets the skill

#### Context

See `## Context`.

#### Business logic

When the scheduler makes an agent's [2] checkout [3] through the library, the library links this package's directory, the one holding `SKILL.md`, into the checkout where each coding agent [6] looks for skills [1] (`src/`). The agent reads `SKILL.md`, learns that it runs `npx branches` inside its checkout, and uses `status`, `name` and `publish`; `create`, `attach`, `list`, `remove` and `prune` belong to whoever started it, and the scheduler and the dashboard's server call the same operations directly as a library. One implementation serves every surface: the agent in its shell, the scheduler at a run's end and in its sweep, and the dashboard's "Remove" button.
