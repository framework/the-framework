---
name: branches
description: Where your work goes (a branch named agent-<name>), how to name it, and what must be true before you finish.
---

# Branch management

Your work goes on a branch named `agent-<name>`, unless whoever started you continued you on another. Whoever started you pushes, opens the pull request, and merges. You never do.

## The command

The `branches` command is a dependency of this repository (`@gemstack/skill-branches`). If `node_modules` is missing, install once with the lockfile's package manager (`npm install` for `package-lock.json`). Then run it as `npx branches`. `status` and `name` are your commands; the rest belong to whoever started you.

## Where you are

```
npx branches status
```

It prints JSON; `branch` is the branch you are on.

**A branch starting with `agent-`.** Its checkout is your whole workspace: read and write only inside it. Dependency files and the skill folders are the user's copies, linked in: never edit them. If something you need is outside your checkout, say so and stop.

Before your first change, name the session with `[a-z0-9-]+` saying what the work is, unless your branch is already named (not `agent-<id>` for the `AGENT_ID` in your environment): then keep it.

```
npx branches name <name>
```

It renames your branch to `agent-<name>` and prints the name it got in `branch`: `agent-<name>-2`, `-3`, … when `<name>` was taken (refused: pick another name).

**Any other branch.** If the checkout sits under `.branches/`, whoever started you put you on this branch on purpose: stay on it, do not name it. Otherwise you are in a plain clone on someone else's branch. Before your first change, create your own and switch to it, `<name>` as above (another if it exists):

```
git switch -c agent-<name>
```

Everything above applies.

## Commit as you go

Only committed work is published. Nothing is committed for you.

## Before you finish

```
npx branches status
```

It must report `"clean": true`. `clean` is false while anything is uncommitted or untracked: commit or delete what you added; if what remains is not yours, say so and finish.
