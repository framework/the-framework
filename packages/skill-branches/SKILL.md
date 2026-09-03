---
name: branches
description: Where your work goes (a branch named agent-<name>), how to name it, and what must be true before you finish.
---

# Branch management

Your work goes on a branch named `agent-<name>`. Whoever started you publishes it — push, pull request, merge — so you never push and never open the pull request yourself.

## The command

`branches` comes with the npm package `@gemstack/skill-branches`, a dependency of this repository. Install the repository's dependencies once — `npm install`, or the package manager its lockfile belongs to — then run it as `npx branches`.

## Where you are

```
npx branches status
```

It prints JSON; `branch` is the branch you are on.

**A branch starting with `agent-`.** The branch is yours, and the checkout it is in is your whole workspace: keep every path you read or write under it, addressed relative to it, never as an absolute path out of it. When the checkout sits under a `.branches/` folder, it was made for you and the repository around it is the user's own working tree, never yours to edit. If something you need is outside your checkout, say so and stop.

Before your first change, name the session — `[a-z0-9-]+`, saying succinctly what the work is:

```
npx branches name <name>
```

It renames your branch to `agent-<name>` — a rename, so your commits stay — and prints the branch it got: `agent-<name>-2`, `-3`, … when `<name>` was taken.

**Any other branch.** You are in a plain clone, on a branch that is not yours. Before your first change, create yours and switch to it — `<name>` is `[a-z0-9-]+`, saying succinctly what the work is:

```
git switch -c agent-<name>
```

## Commit as you go

Only what you committed is ever published: nothing is committed on your behalf, and uncommitted work is neither published nor cleaned up.

## Before you finish

```
npx branches status
```

It must report `"clean": true`.
