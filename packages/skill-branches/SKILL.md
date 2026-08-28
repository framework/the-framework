---
name: branches
description: One git checkout per agent, named as its branch. How to name your session, where your work lives, and what must be true before you finish.
---

# Branch management

You were started inside your own checkout of the repository: a git worktree at `.branches/agent-<id>/`, on a branch of the same name. Your working directory is the whole of your workspace.

## Workspace

- Every file you read or write is under your working directory. Address files relative to it — an absolute path is how you leave it without noticing.
- The repository around your checkout is the user's own working tree. It is not another view of your files, and it is never yours to edit: the same file exists twice, and only the copy under your working directory is on your branch. Editing the other one puts your work where your commits cannot reach it.
- If something you genuinely need is outside your working directory, say so and stop — do not reach for it.

## Name the session

Before your first change, pick a name for the session — `[a-z0-9-]+`, saying succinctly what the work is — and run:

```
branches name <name>
```

It renames your branch to `agent-<name>` (a rename: your commits stay where they are) and prints the name the branch got, as JSON: `{"ok":true,"branch":"agent-<name>"}`. When `<name>` was already taken, the branch is `agent-<name>-2`, `-3`, … — use the name it printed, not the one you asked for. The session name is read from your branch; there is nothing else to report.

## Commit as you go

Work on that branch and commit to it as you go. Only what you committed is ever published — nothing is committed on your behalf, and work left uncommitted stays in your checkout.

## Before you finish

Run:

```
branches status
```

It must report `"clean": true`. Uncommitted work blocks the checkout from being reclaimed, and is not part of what gets published.

Do not push, and do not open the pull request yourself: publishing — push, pull request, merge — is done for you, as the user configured it.
