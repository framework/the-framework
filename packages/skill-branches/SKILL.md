---
name: branches
description: Where your work goes — a branch named agent-<name>, in a checkout of your own when one was made for you — how to name it, and what must be true before you finish.
---

# Branch management

Your work goes on a branch named `agent-<name>`. Whoever started you publishes it — push, pull request, merge — so you never push and never open the pull request yourself.

## The command

`branches` comes with the npm package `@gemstack/skill-branches`, a dependency of this repository. Install the repository's dependencies once — `npm install`, or the package manager its lockfile belongs to — then run it as `npx branches`.

## Where you are

```
npx branches status
```

It prints the branch you are on.

**It starts with `agent-`.** A checkout was made for you, under the project's `.branches/`, and your working directory is your whole workspace: every file you read or write is under it, so address files relative to it — an absolute path is how you leave it without noticing. The repository around it is the user's own working tree, never yours to edit: the same file exists there twice, and only the copy under your working directory is on your branch. If something you genuinely need is outside your working directory, say so and stop.

Before your first change, name the session — `[a-z0-9-]+`, saying succinctly what the work is:

```
npx branches name <name>
```

It renames your branch to `agent-<name>` — a rename, so your commits stay — and prints the name the branch got: `agent-<name>-2`, `-3`, … when `<name>` was taken.

**Any other branch.** You are in a plain clone, on a branch that is not yours. Before your first change, create yours and switch to it:

```
git switch -c agent-<name>
```

## Commit as you go

Commit to your branch as you go. Only what you committed is ever published: nothing is committed on your behalf, and uncommitted work stays where it is — neither published nor cleaned up.

## Before you finish

```
npx branches status
```

It must report `"clean": true`.
