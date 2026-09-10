Makes a checkout [1] as an agent [2] gets it, in one sequence whichever surface asks for it (the daemon starting an agent, or the `branches` command line): the git worktree itself, then `.branches/` hidden from git, the user's installed dependency trees linked in, the skills [3] linked in where the coding agent [4] looks for them, and the branch links [5] under `.branches/` brought up to date. A new agent gets a fresh branch of its own; a continued agent gets back the branch its work is on.

## Context

**User story**: the user starts an agent [2] and it can work at once: its checkout [1] holds the project's files on a branch of its own, the installed dependencies, and the `branches` skill [3] to read. The user continues a finished agent and it finds itself on the branch holding its previous commits, set up the same way.

**Problem**: git creates a worktree from the repository alone: no `node_modules`, no skill directories, and an untracked `.branches/` directory at the project's root that a sweeping `git add -A` in the user's checkout would commit onto a code branch. Everything a checkout needs beyond its files has to be added after the worktree, and none of it is worth failing the agent's start over.

## Glossary

[1] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout" or "the user's checkout".
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] skill: one of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads (its `SKILL.md`, linked into the checkout where the coding agent's harness looks for skills), a command on the agent's PATH, and an API the product calls.
[4] coding agent: the CLI doing the actual work: Claude Code or Codex.
[5] branch link: a symbolic link under `.branches/`, named as the branch a checkout is on now and pointing at that checkout's directory, so `.branches/<branch>` reaches the checkout by its current branch name.
[6] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[7] birth branch: the branch a checkout is created on, `agent-<agent id>`, which also names the checkout's directory; the agent's branch until the agent names its work.
[8] reclaim: removing a finished agent's checkout once its work is on the remote.

## Business logic — TL;DR

- **A new agent's checkout** - a worktree on the fresh birth branch [7] `agent-<agent id>`, from the base the caller names or the project's head, then settled.
- **A continued agent's checkout** - a worktree on the branch the caller names, the one the agent's work is on, then settled the same way.
- **What a checkout gets besides its files** - `.branches/` hidden from git, the user's dependency trees linked in, the `branches` skill and any further skills the caller names linked in, and the branch links reconciled, in that order.
- **Only the worktree can fail the caller** - a checkout missing any of the rest is a worse agent, not a failed one.

## Business logic

### A new agent's checkout

#### Context

See `## Context`.

#### Business logic

Given the project's checkout, an agent id [6] and, optionally, a base revision and further skills [3] to link, a worktree is created at `.branches/agent-<agent id>` on the new branch `agent-<agent id>`, the birth branch [7], starting from the base when one is named and from the commit the project's checkout is on otherwise (the creation rules, the id check included, are in `worktree.ts`). The checkout [1] is then settled as described below, and the caller gets the checkout's path and branch back.

### A continued agent's checkout

#### Context

**User story**: the user continues an agent [2] whose checkout was reclaimed [8]; the agent must find itself on the branch its work is on rather than on a fresh branch that strands its previous commits.

#### Business logic

Given the project's checkout, an agent id [6], the branch to continue on and, optionally, further skills [3] to link, a worktree is created at `.branches/agent-<agent id>` with that branch checked out, whatever the branch's name (the rules for a branch gone locally or gone everywhere are in `worktree.ts`). The checkout [1] is then settled exactly as a new agent's, and the caller gets the checkout's path and branch back.

### What a checkout gets besides its files

#### Context

See `## Context`.

#### Business logic

Once the worktree exists, four steps run in this order:

- `.branches/` is hidden from git: the rule `/.branches` is added to the repository's own exclude file, the ignore list that is git's and not the project's, so no tracked file changes and the rule holds from the first checkout [1] on, for every checkout of the repository.
- The user's installed dependency trees are linked into the checkout, so the agent [2] runs without installing (the rules are in `worktree-deps.ts`).
- The `branches` skill [3] is linked into the checkout where each coding agent [4] looks for skills, and beside it every further skill the caller named, each under its own name (the rules are in `skill-links.ts`). Naming further skills is a stopgap until projects commit their own skill files; the command line names none.
- The branch links [5] under `.branches/` are reconciled against what is on disk, so the checkout is reachable by its current branch name (the rules are in `branch-links.ts`).

### Only the worktree can fail the caller

#### Context

**Problem**: an agent [2] that wants to start needs its checkout [1]; it does not need every convenience to succeed, and a failure in one of them must not cost the start.

#### Business logic

A failure to create the worktree surfaces to the caller: no checkout [1], no agent [2]. Every step after it is best-effort: a failure to write the exclude file, a dependency tree that cannot be linked and a branch-link pass that fails are each swallowed, and a skill [3] link that cannot be made costs the agent that skill only (`skill-links.ts`). The checkout is handed over regardless: a branch link [5] is only a view that the next reconciling pass makes, and a checkout without its dependencies or a skill is a worse agent, not a failed one.
