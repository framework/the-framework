---
name: branches
description: Where your work goes (a branch named agent-<name>), how to name it, and what must be true before you finish.
---

# Branch management

Your work goes on a branch named `agent-<name>`, unless whoever started you continued you on another. Whoever started you pushes, opens the pull request, and merges. You never do.

## The command

`branches` is a dependency of this repository (`@gemstack/skill-branches`). If `node_modules` is missing, install with the lockfile's package manager (`npm install` for `package-lock.json`). Then run `npx branches` inside your checkout. `status` and `name` are yours; the rest are the caller's.

## Where you are

```
npx branches status
```

It prints JSON; `branch` is the branch you are on.

**A branch starting with `agent-`.** Its checkout is your whole workspace: read and write only there. Dependency files and skill folders are links to the user's copies: never edit them. If something you need is outside your checkout, say so and stop.

Before your first change, name the session with `[a-z0-9-]+`, starting with a letter or digit, saying what the work is, unless your branch already differs from `path`'s last segment: then it is named, keep it.

```
npx branches name <name>
```

It renames your branch to `agent-<name>` and prints it in `branch`: `agent-<name>-2`, `-3`, … when `<name>` was taken; a name outside `[a-z0-9-]+` is refused as `invalid-name`.

**Any other branch.** If the checkout sits under `.branches/`, you were put on this branch on purpose: stay on it, do not name it. Otherwise you are in a plain clone on someone else's branch. Before your first change, create your own and switch to it, `<name>` as above (another if it exists, locally or on origin):

```
git switch -c agent-<name>
```

Everything above applies.

## Commit as you go

Nothing is committed for you.

## Before you finish

```
npx branches status
```

It must report `"clean": true`. `clean` is false while anything is uncommitted or untracked: commit or delete what you added; if what remains is not yours, say so and finish.
