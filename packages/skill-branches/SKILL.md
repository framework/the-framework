---
name: branches
description: Where your work goes (a branch named agent-<name>), how to name it, and what must be true before you finish.
---

# Branch management

Your work goes on a branch named `agent-<name>`. Whoever started you pushes it, opens the pull request, and merges. You never do.

## The command

The `branches` command is a dependency of this repository (`@gemstack/skill-branches`). If there is no `node_modules` yet, install the repository's dependencies once (`npm install`, or the package manager its lockfile belongs to). Then run it as `npx branches`; with no arguments it prints the usage on stderr.

## Where you are

```
npx branches status
```

It prints JSON; `branch` is the branch you are on.

**A branch starting with `agent-`.** The branch is yours, and the checkout it is in is your whole workspace: every path you read or write is inside it. Everything outside your checkout is the user's, never yours to edit. If something you need is outside your checkout, say so and stop.

Before your first change, name the session — `[a-z0-9-]+`, saying succinctly what the work is:

```
npx branches name <name>
```

It renames your branch to `agent-<name>` and prints the resulting name as `branch`: `agent-<name>-2`, `-3`, … when `<name>` was taken.

**Any other branch.** You are in a plain clone, on a branch that is not yours. Before your first change, create yours and switch to it, `<name>` as above (another name if that one exists):

```
git switch -c agent-<name>
```

## Commit as you go

Only committed work is published. Nothing is committed for you, and uncommitted work is left where it is.

## Before you finish

```
npx branches status
```

It must report `"clean": true`.
