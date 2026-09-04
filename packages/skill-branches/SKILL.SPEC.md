The skill's instructions: what an agent is told about where its work goes, for every place it can wake up in. Found by an agent as a skill of its harness — linked into every checkout the package creates (`src/skill-links`), or committed into the repository.

## User story

- The user starts an agent — from a caller's UI that made it a checkout of its own, or in a plain clone of the repository — and expects its work on a branch named after what it did, publishable as a pull request, with nothing touched on the user's own branch.

## Business logic — TL;DR

- **One rule wherever the agent is** - the work goes on a branch named `agent-<name>`, unless the caller continued the agent on another, and whoever started the agent publishes it: the agent never pushes and never opens the pull request.
- **The command is installed, then run through npx** - `branches` ships with the `@gemstack/skill-branches` package the repository depends on; the agent installs the repository's dependencies once, when there is no `node_modules` yet, with the package manager the lockfile belongs to, and runs `npx branches` inside its checkout, so every command the skill names runs as written on a fresh clone. `status` and `name` are the agent's commands; the rest are the caller's.
- **Where the agent is, read off its branch** - `npx branches status` prints the branch. One starting with `agent-` is the agent's own; any other means a plain clone, on a branch that is not the agent's, unless the checkout sits under `.branches/`: then the agent was continued on that branch on purpose and stays on it.
- **On its own branch, the working directory is the whole workspace** - every file the agent reads or writes is under it; dependency files and the skill folders are the user's copies, linked in, and are never edited; anything it genuinely needs from outside is a reason to say so and stop. Before the first change it names the session with `npx branches name <name>` — a rename of its branch to `agent-<name>`, suffixed when the name was taken, printed as `branch`, another name when refused as invalid — unless the branch already differs from the checkout's folder name, which a continued agent's does: then it is named and kept.
- **In a plain clone, the agent makes its branch itself** - before the first change, `git switch -c agent-<name>`, another name if that one exists locally or on origin; the same workspace rules apply.
- **Commit as you go** - only what the agent committed is ever published; nothing is committed on its behalf.
- **Leave a clean tree** - before finishing, `npx branches status` must report a clean tree: nothing uncommitted and nothing untracked, so the agent commits or deletes what it added; what remains and is not its own it reports and finishes.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
