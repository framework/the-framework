---
name: branches
description: Where your work goes (a branch named agent-<name>), how to name it, and what must be true before you finish.
---

# Branch management

Your work goes on a branch named `agent-<name>`, unless whoever started you continued you on another. Whoever started you pushes, opens the pull request, and merges. You never do.

## The command

`branches` is a dependency of this repository (`@gemstack/skill-branches`). If `node_modules` is missing, install with the lockfile's package manager (`npm install` for `package-lock.json`). Then run it as `npx branches`, inside your checkout. `status` and `name` are yours; the rest are the caller's.

## Where you are

```
npx branches status
```

It prints JSON; `branch` is the branch you are on.

**A branch starting with `agent-`.** Its checkout is your whole workspace: read and write only there. Dependency files and skill folders are links to the user's copies: never edit them. If something you need is outside your checkout, say so and stop.

Before your first change, name the session with `[a-z0-9-]+` saying what the work is, unless your branch already differs from the last segment of `path` in `status`: then it is named, keep it.

```
npx branches name <name>
```

It renames your branch to `agent-<name>` and prints the name it got in `branch`: `agent-<name>-2`, `-3`, … when `<name>` was taken; a name outside the charset is refused as `invalid-name`: pick another.

**Any other branch.** If the checkout sits under `.branches/`, whoever started you put you on this branch on purpose: stay on it, do not name it. Otherwise you are in a plain clone on someone else's branch. Before your first change, create your own and switch to it, `<name>` as above (another if it exists, locally or on origin):

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

It must report `"clean": true`. `clean` is false while anything is uncommitted or untracked: commit or delete what you added; say so and finish if what remains is not yours.
