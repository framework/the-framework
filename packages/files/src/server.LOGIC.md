The Files module's server part: the five reads its browser part makes, each given the project's folder and the agent's facts [3], each answering from git. A read about an agent [1] takes the agent's id and reads wherever the agent's files are now (`tree.ts`); a read without one is about the project's own checkout [2].

## Context

**User story**: the Files tab, the hover card and a working agent's list of changed files all read through these, so each shows the same files from the same place.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is the project's checkout.
[3] the agent's facts: what the dashboard tells a module's server part about one agent when asked: its checkout while it has one, its record (status, machine, branch, pull request number), and whether it finished on this machine having changed nothing; and, on request, the commit a pull request of a branch merged as, or that the git host is still being asked.

## Business logic — TL;DR

- **`project`** - every file of the project's checkout, with each file changed on disk marked, all uncommitted.
- **`tree`** - an agent's files wherever they are now, what it changed marked; the project's files unmarked for an agent the dashboard does not know yet (it is starting), gone for an input with no agent.
- **`diff`** - one changed file's diff: the agent's, from the same place its tree is read; without an agent, the project checkout's uncommitted change, its status taken from git and never from the browser.
- **`content`** - one unchanged file's contents, from the same place.
- **`changes`** - a working agent's changed files with their line counts, from its own checkout only.

## Business logic

### `project`

#### Context

**User story**: on a project's own page the Files tab lists the repository and marks what the user has changed and not committed.

#### Business logic

The file list (`list.ts`) and the per-file status (`status.ts`) of the project's checkout are read together. The answer is the list and one mark per changed path: its state, and not committed.

### `tree`, `diff` and `content`

#### Context

See `## Context`.

#### Business logic

With an agent's id, where the agent's files are is worked out once per read from the agent's facts [3] (`tree.ts`), and the tree, the diff or the contents come from that place, so the preview always shows the change the tree marked. A failure while reading the tree answers gone. Without an agent, the tree is gone (the project's own tree is `project`), a diff is the project checkout's uncommitted change for a path git reports changed (nothing for any other path), and the contents are the file on disk in the project's checkout. A path that is not a plain repository-relative path yields nothing (`read.ts`).

### `changes`

#### Context

**Problem**: an agent with no checkout left has its changes on its branch, which the dashboard's handoff shows. Reading its id against the project's folder would present the user's own uncommitted files as the agent's.

#### Business logic

The agent's checkout is taken from the agent's facts [3]. With one, the answer is every changed file there with its line counts (`diff.ts`); with none, or without an agent's id, the answer is an empty list.
