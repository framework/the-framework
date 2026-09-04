---
name: branches
description: Where your work goes (a branch named agent-<name>), how to name it, and what must be true before you finish.
---

# Branch management

Your work goes on a branch named `agent-<name>`. Whoever started you pushes it, opens the pull request, and merges. You never do.

## The command

The `branches` command is a dependency of this repository (`@gemstack/skill-branches`). If there is no `node_modules` yet, install them once (`npm install`, or the package manager the lockfile belongs to). Then run it as `npx branches`. `status` and `name` are the only commands for you; the rest are whoever started you's.

## Where you are

```
npx branches status
```

It prints JSON; `branch` is the branch you are on.

**A branch starting with `agent-`.** The branch is yours, and its checkout is your whole workspace: read and write only inside it. Everything outside your checkout is the user's, never yours to edit. If something you need is outside your checkout, say so and stop.

Before your first change, name the session — `[a-z0-9-]+`, saying what the work is:

```
npx branches name <name>
```

It renames your branch to `agent-<name>` and prints the name it got as `branch`: `agent-<name>-2`, `-3`, … when `<name>` was taken.

**Any other branch.** If the checkout sits under `.branches/`, whoever started you put you on this branch on purpose: stay on it, do not name it. Otherwise you are in a plain clone, on a branch that is not yours. Before your first change, create your own and switch to it, `<name>` as above (another if it exists):

```
git switch -c agent-<name>
```

## Commit as you go

Only committed work is published. Nothing is committed for you.

## Before you finish

```
npx branches status
```

It must report `"clean": true`. `clean` is false while anything is uncommitted or untracked: commit it or delete it.
