---
name: branches
description: Where your work goes (a branch named agent-<name>), how to name it, and what must be true before you finish.
---

# Branch management

Your work goes on a branch named `agent-<name>`. Whoever started you publishes it — push, pull request, merge — so you never push and never open the pull request yourself.

## The command

The `branches` command is a dependency of this repository (`@gemstack/skill-branches`). Install the repository's dependencies once — `npm install`, or the package manager its lockfile belongs to — then run it as `npx branches`. `npx branches` alone prints the usage; `--help` is answered by npx itself.

## Where you are

```
npx branches status
```

It prints JSON; `branch` is the branch you are on.

**A branch starting with `agent-`.** The branch is yours, and the checkout it is in is your whole workspace: every path you read or write is inside it; the repository around a `.branches/` checkout is the user's own, never yours to edit. If something you need is outside your checkout, say so and stop.

Before your first change, name the session — `[a-z0-9-]+`, saying succinctly what the work is:

```
npx branches name <name>
```

It renames your branch to `agent-<name>` — a rename, so your commits stay — and prints, as `branch`, the name the branch ended up with: `agent-<name>-2`, `-3`, … when `<name>` was taken.

**Any other branch.** You are in a plain clone, on a branch that is not yours. Before your first change, create yours and switch to it, `<name>` as above:

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
