Activates a repository for OpenAgent, which is what adding a project does to it: a `.openagent/` directory holding the ignore file that keeps agent [1] state off the code branches, committed as exactly one commit that contains nothing of the user's own. A repository that is already activated is left untouched, a folder that is not a repository yet is made one first, and any failure is reported as an answer rather than thrown.

## Context

**User story**: the user adds a repository by path on the Overview, or runs `openagent` inside one, and from then on the repository is a project agents [1] can work: it carries one commit titled "[OpenAgent] install OpenAgent" and a `.openagent/` directory, and nothing the user had uncommitted is touched.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. OpenAgent starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".

## Business logic — TL;DR

- **The ignore file is the activation marker** - a repository whose `.openagent/.gitignore` exists is already activated: the answer says so and nothing runs, not even git.
- **A folder that is not a repository is made one** - git is the source of truth, so a folder outside any repository is initialized for the user instead of refused, and the answer says it was.
- **What activation writes** - `.openagent/` with its ignore file, and nothing else.
- **One commit, of OpenAgent's directory only** - only `.openagent` is staged, never everything, and it is committed as "[OpenAgent] install OpenAgent"; whatever the user has uncommitted stays theirs, uncommitted.
- **Failures are answers** - a git or filesystem failure at any step is returned with its message, never thrown, so the dashboard can show why the project could not be added.

## Business logic

### The ignore file is the activation marker

#### Context

**Problem**: a `.openagent/` directory can exist without the repository being activated, because the daemon creates one wherever it runs for its own state. Only the ignore file proves activation, since it is what keeps OpenAgent's state off the repository's branches.

#### Business logic

Activation first looks for `.openagent/.gitignore`. When it exists the repository is already activated: the answer is a success flagged as already activated, and no file is written and no git command runs. The same file is what `project.ts` reads to tell an activated project from any other directory.

### A folder that is not a repository is made one

#### Context

**User story**: the user adds a folder that has never been under git; OpenAgent treats git as the source of truth, so it needs a repository to work in.

#### Business logic

When the folder is not inside a git working tree (a git that cannot answer the question counts as "not inside one"), a repository is initialized in it before anything else, and the final answer says the repository was initialized. A folder already inside a repository is used as it is.

### What activation writes

#### Context

**Business logic story**: the ignore file's rules are in `framework-gitignore.ts`. OpenAgent ships no prompt text, so activation writes no prompt files.

#### Business logic

Activation creates `.openagent/` and writes into it the ignore file, which ignores everything under `.openagent/` except itself. The ticket format's specification is deliberately not written: it ships inside the package and versions with it.

### One commit, of OpenAgent's directory only

#### Context

**Problem**: the user's checkout [3] may hold uncommitted work when they add the project. Sweeping it into a commit on their behalf would publish changes they never meant to commit.

#### Business logic

Only the `.openagent` directory is staged, never the whole working tree, and one commit is made with the message "[OpenAgent] install OpenAgent". A dirty repository therefore gets the same single commit as a clean one, and the user's uncommitted changes are exactly as they were.

### Failures are answers

#### Context

See `## Context`.

#### Business logic

Any failure after the activation check, a git command that fails or a file that cannot be written, ends the activation with a failure carrying the error's message, never with a thrown error. The caller (`daemon-runtime.ts`, for the dashboard's add-project action) reports that message to the user.
