---
name: branches
description: Where your work goes (a branch named agent-<name>), how to name it, what must be true before you finish, and how to push it.
---

# Branch management

Your work goes on a branch named `agent-<name>`, unless whoever started you continued you on another. When you finish, you push it yourself; what happens to a pushed branch next, if anything, is another skill's. Unless whoever started you said they publish for you: then you never push.

## The command

`branches` is a dependency of this repository (`@gemstack/skill-branches`). If `node_modules` is missing, install with the lockfile's package manager (`npm install` for `package-lock.json`). Then run `npx branches` inside your checkout, never a bare `branches`: a fresh clone has none. `status`, `name` and `push` are yours; the rest are the caller's.

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

From then on, work as on an `agent-` branch; nothing in a plain clone is a link.

## Commit as you go

Nothing is committed for you.

## Before you finish

```
npx branches status
```

It must report `"clean": true`. `clean` is false while anything is uncommitted or untracked: commit or delete what you added; if what remains is not yours, say so and finish.

## Push

Once clean, unless whoever started you said they publish for you:

```
npx branches push
```

It pushes your branch to origin and prints it in `branch`. `clean` false is refused as `dirty`: commit or delete first.
