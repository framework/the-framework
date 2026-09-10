The `branches` skill [1], one of the four skills every agent [2] is taught: one git worktree per agent under the project's `.branches/` directory, the agent's checkout [3], named as its branch and reclaimed [4] once its work is on the remote. The package is three things at once: the instructions the agent reads (`SKILL.md`), the `branches` command every agent gets on its PATH (`bin/`, `src/cli.ts`), and the library the daemon and the dashboard call to make, name, list and reclaim checkouts (`src/`). `package.json` and the `tsconfig*.json` files configure the package, its build and its tests, `dist/` and `dist-test/` are build output, and `DECISIONS.md` records the decisions the code implements; none of them carries business logic of its own.

## Context

**User story**: the user starts agents [2] from the dashboard and each works in a checkout [3] of its own while the user's working copy stays untouched; the agent names its work and the dashboard labels it by that session name [5]; when the agent is done and its work is on the remote, its checkout goes away on its own, and the user never loses work to that removal.

## Glossary

[1] skill: one of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads (its `SKILL.md`, linked into the checkout where the coding agent's harness looks for skills), a command on the agent's PATH, and an API the product calls.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] reclaim: removing a finished agent's checkout once its work is on the remote.
[5] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[6] coding agent: the CLI doing the actual work: Claude Code or Codex.

## Business logic — TL;DR

- **What the agent is told** (`SKILL.md`) - its work goes on `agent-<name>`, named before its first change; it reads and writes only in its checkout [3]; it commits as it goes and finishes only when its checkout is clean; whoever started it pushes, opens the pull request and merges.
- **The library and the command** (`src/`) - the names, git's worktree mechanism, the checkout sequence, the dependency and skill links, the links under `.branches/`, reclaiming [4], and the `branches` command over all of it.
- **The executable** (`bin/`) - the `branches` file the package registers as the command.
- **How an agent gets the skill** - the instructions, the command and the library meet in every checkout.

## Business logic

### How an agent gets the skill

#### Context

See `## Context`.

#### Business logic

When the daemon makes an agent's [2] checkout [3] through the library, the library links this package's directory, the one holding `SKILL.md`, into the checkout where each coding agent [6] looks for skills [1], and the daemon puts the package's `bin/` directory on the agent's PATH (`src/`). The agent reads `SKILL.md`, learns that it runs `npx branches` inside its checkout, and uses `status` and `name`; `create`, `attach`, `list`, `remove` and `prune` belong to whoever started it, and the daemon calls the same operations directly as a library. One implementation serves every surface: the agent in its shell, the daemon's sweeps, and the dashboard's "Remove" button.
