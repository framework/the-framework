Activates a repository for The Framework, which is what adding a project does to it: a `.the-framework/` directory holding the ignore file that keeps agent [1] state off the code branches, the `LAYOUT` marker that records this build's bookkeeping layout, and the six quality presets as files, committed as exactly one commit that contains nothing of the user's own. A repository that is already activated is left untouched, a folder that is not a repository yet is made one first, and any failure is reported as an answer rather than thrown.

## Context

**User story**: the user adds a repository by path on the Overview, or runs `the-framework` inside one, and from then on the repository is a project agents [1] can work: it carries one commit titled "[The Framework] install The Framework" and a `.the-framework/` directory, and nothing the user had uncommitted is touched.

## Glossary

[1] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[3] checkout: An agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".

## Business logic — TL;DR

- **The ignore file is the activation marker** - a repository whose `.the-framework/.gitignore` exists is already activated: the answer says so and nothing runs, not even git.
- **A folder that is not a repository is made one** - git is the source of truth, so a folder outside any repository is initialized for the user instead of refused, and the answer says it was.
- **What activation writes** - `.the-framework/` with its ignore file, the `LAYOUT` marker and the presets `maintainability`, `readability`, `security_audit`, `research`, `ux` and `maintenance` as `.the-framework/presets/<name>.md`, rewritten on every activation so they track the installed version.
- **One commit, of The Framework's directory only** - only `.the-framework` is staged, never everything, and it is committed as "[The Framework] install The Framework"; whatever the user has uncommitted stays theirs, uncommitted.
- **Failures are answers** - a git or filesystem failure at any step is returned with its message, never thrown, so the dashboard can show why the project could not be added.

## Business logic

### The ignore file is the activation marker

#### Context

**Problem**: a `.the-framework/` directory can exist without the repository being activated, because the daemon creates one wherever it runs for its own state. Only the ignore file proves activation, since it is what keeps The Framework's state off the repository's branches.

#### Business logic

Activation first looks for `.the-framework/.gitignore`. When it exists the repository is already activated: the answer is a success flagged as already activated, and no file is written and no git command runs. The same file is what `project.ts` reads to tell an activated project from any other directory.

### A folder that is not a repository is made one

#### Context

**User story**: the user adds a folder that has never been under git; The Framework treats git as the source of truth, so it needs a repository to work in.

#### Business logic

When the folder is not inside a git working tree (a git that cannot answer the question counts as "not inside one"), a repository is initialized in it before anything else, and the final answer says the repository was initialized. A folder already inside a repository is used as it is.

### What activation writes

#### Context

**Business logic story**: the ignore file's rules are in `framework-gitignore.ts`; the marker's content and what a mismatch means are in `layout.ts`. The presets are written so that a queue entry [2] on the agent queue that asks an agent [1] to run one of them names a real file the agent can open in its checkout [3].

#### Business logic

Activation creates `.the-framework/` and writes into it: the ignore file, which ignores everything under `.the-framework/` except itself and `LAYOUT`; the `LAYOUT` marker with this build's bookkeeping layout, tracked, so a build whose layout differs refuses to run in the repository instead of committing wrong-layout files; and the six quality presets, `maintainability`, `readability`, `security_audit`, `research`, `ux` and `maintenance`, as `.the-framework/presets/<name>.md` with their blanks left unrendered, since the queue entry tells the agent what to fill in. The presets are overwritten on every activation, so a re-activation refreshes them to the installed version, and being ignored by git they never go stale in the repository's history. The ticket format's specification is deliberately not written: it ships inside the package and versions with it.

### One commit, of The Framework's directory only

#### Context

**Problem**: the user's checkout [3] may hold uncommitted work when they add the project. Sweeping it into a commit on their behalf would publish changes they never meant to commit.

#### Business logic

Only the `.the-framework` directory is staged, never the whole working tree, and one commit is made with the message "[The Framework] install The Framework". A dirty repository therefore gets the same single commit as a clean one, and the user's uncommitted changes are exactly as they were.

### Failures are answers

#### Context

See `## Context`.

#### Business logic

Any failure after the activation check, a git command that fails or a file that cannot be written, ends the activation with a failure carrying the error's message, never with a thrown error. The caller (`daemon-runtime.ts`, for the dashboard's add-project action) reports that message to the user.
