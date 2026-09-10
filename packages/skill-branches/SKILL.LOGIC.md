The instructions every agent [1] reads as its `branches` skill [2]: its work goes on a branch named `agent-<name>`, which it names before its first change; it reads and writes only in its checkout [3]; it commits as it goes; and it finishes only when `npx branches status` reports the checkout clean. Whoever started the agent pushes, opens the pull request and merges; the agent never does.

## Context

**User story**: an agent [1] starts in a checkout [3] with no explanation of the layout it sits in. The user later sees its branch as `agent-<session name>`, the dashboard labels the agent by that session name [4], and the handoff [5] (push, pull request, merge) happens on the agent's behalf once its work is committed.

**Problem**: the agent is a coding agent [6] driven as a black box, so the only way to make it behave in its checkout is to tell it, in text it reads when it starts. Left untold, it cannot know that the dependency files and skill directories in its checkout are links to the user's copies, that a branch differing from its directory's name means it was continued and already named, or that an uncommitted file keeps its checkout from ever being reclaimed [7].

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] skill: one of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads (its `SKILL.md`, linked into the checkout where the coding agent's harness looks for skills), a command on the agent's PATH, and an API the product calls.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[5] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[6] coding agent: the CLI doing the actual work: Claude Code or Codex.
[7] reclaim: removing a finished agent's checkout once its work is on the remote.
[8] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.

## Business logic — TL;DR

- **The work goes on `agent-<name>`, and the agent never hands it off** - the branch is the agent's; the push, the pull request and the merge belong to whoever started it.
- **How the command is run** - `npx branches` inside the checkout, after an install with the lockfile's package manager when `node_modules` is missing; `status` and `name` are the agent's commands, the rest are the caller's.
- **Where the agent is** - `npx branches status` prints JSON whose `branch` is the branch the agent is on, and that branch decides everything below.
- **On an `agent-` branch, the checkout is all the agent touches** - read and write only there, never edit the linked dependency files and skill directories, and stop when something needed lies outside.
- **Name the work before the first change** - `npx branches name <name>`, `[a-z0-9-]+` starting with a letter or digit, saying what the work is; unless the branch already differs from the directory's name, which means it is named already.
- **On another branch under `.branches/`, stay** - the agent was put there on purpose and does not name it.
- **In a plain clone, make an `agent-<name>` branch with git** - before the first change, and another name when that one exists locally or on `origin`.
- **Commit as you go** - nothing is committed for the agent.
- **Finish only clean** - `status` must report `"clean": true`; commit or delete what was added, and when what remains is not the agent's, say so and finish.

## Business logic

### The work goes on `agent-<name>`, and the agent never hands it off

#### Context

**User story**: the user starts an agent [1] and later finds its work pushed, opened as a pull request, or merged, whichever handoff [5] the user chose; the agent itself never touches the remote.

#### Business logic

The agent [1] is told that its work goes on a branch named `agent-<name>`, unless whoever started it continued it on another branch. Whoever started the agent pushes, opens the pull request and merges; the agent never does any of the three.

### How the command is run

#### Context

**Problem**: on a fresh clone the `branches` command does not exist yet: it is a dependency of the repository, present only once the dependencies are installed.

#### Business logic

The agent [1] is told that `branches` is a dependency of the repository, the package `@gemstack/skill-branches`; that when `node_modules` is missing it installs with the package manager the lockfile belongs to (`npm install` for a `package-lock.json`); and that it then runs `npx branches` inside its checkout [3], never a bare `branches`. Of the commands, `status` and `name` are the agent's; the rest belong to whoever started it.

### Where the agent is

#### Context

See `## Context`.

#### Business logic

The agent's [1] first step is `npx branches status`, which prints JSON; `branch` is the branch the agent is on, and `path` is its checkout's [3] root. Which branch it is decides which of the three situations below the agent is in: a branch starting with `agent-`, another branch in a checkout under `.branches/`, or another branch in a plain clone.

### On an `agent-` branch, the checkout is all the agent touches

#### Context

**Problem**: an agent's [1] checkout [3] holds links to the user's own copies of the dependency files (`node_modules`) and of the skill [2] directories. An edit through such a link changes the user's copy, and with it every other agent's.

#### Business logic

When the branch starts with `agent-`, the checkout [3] is, in the skill's [2] words, the agent's [1] "whole workspace": it reads and writes only there. The dependency files and skill [2] directories in the checkout are links to the user's copies and are never edited. When something the agent needs lies outside its checkout, the agent says so and stops.

### Name the work before the first change

#### Context

**User story**: the dashboard labels the agent [1] by its session name [4], and `.branches/agent-<name>` reaches its checkout [3]; the agent asked for a name and reads back the one it got.

#### Business logic

Before its first change, the agent [1] on an `agent-` branch gives its session name [4] with `npx branches name <name>`: `<name>` matches `[a-z0-9-]+`, starts with a letter or a digit, and says what the work is. The command renames the branch to `agent-<name>` and prints the branch it got in `branch`: `agent-<name>-2`, `-3`, and so on when `<name>` was taken. A name outside `[a-z0-9-]+` is refused as `invalid-name`. One exception: when the branch already differs from the last segment of `path`, the checkout's [3] directory name, the work is named already, as a continued agent's is, and the agent keeps that name.

### On another branch under `.branches/`, stay

#### Context

See `## Context`.

#### Business logic

When the branch does not start with `agent-` and the checkout [3] sits under `.branches/`, the agent [1] was put on this branch on purpose: it stays on it and does not name it.

### In a plain clone, make an `agent-<name>` branch with git

#### Context

**User story**: an agent [1] started outside The Framework's checkouts [3], a cloud session [8] on a plain clone of the repository say, still ends on a branch of its own, named the same way, so its work is handed off like any agent's.

#### Business logic

When the branch does not start with `agent-` and the checkout [3] is not under `.branches/`, the agent [1] is in a plain clone on someone else's branch. Before its first change it creates its own branch and switches to it with `git switch -c agent-<name>`, `<name>` chosen by the same rule as above, and another name when that branch exists locally or on `origin`. From then on everything said for an `agent-` branch applies.

### Commit as you go

#### Context

**Problem**: nothing is committed on the agent's [1] behalf; an uncommitted change never reaches the handoff [5] and keeps the checkout [3] from being reclaimed [7] (`src/reclaim.ts`).

#### Business logic

The agent [1] is told that nothing is committed for it, so it commits as it goes.

### Finish only clean

#### Context

**Business logic story**: a checkout [3] is reclaimed [7] only when it is clean and its tip is on the remote; `clean` in `status` is that same read (`src/cli.ts`).

#### Business logic

Before finishing, the agent [1] runs `npx branches status` again, and it must report `"clean": true`. `clean` is false while anything is uncommitted or untracked; the agent commits or deletes what it added. When what remains is not the agent's own, it says so and finishes.
