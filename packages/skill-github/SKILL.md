---
name: github
description: The project's git host is GitHub: how to open your pull request once your branch is pushed, how to land it, and how to read and close the project's issues.
---

# GitHub

The project's pull requests and issues are on GitHub. This skill is how you reach them.

## The command

`github` is a dependency of this repository (`@gemstack/skill-github`). If `node_modules` is missing, install with the lockfile's package manager (`npm install` for `package-lock.json`). Then run `npx github` inside your checkout. It prints JSON; a refusal exits 1 with a line on stderr; a wrong command line exits 2 with the usage.

## Your pull request

Once your branch is pushed (your branches skill says how), open its pull request:

```
npx github open --title "<one line naming what the change does>" --body "<what changed, and why>"
```

It opens the pull request for the branch you are on and prints it in `request` (`number`, `url`). A branch that already has an open pull request gets no second one: that one is answered, with `existing` true. Add `--merge` when the work may land on its own: the pull request then merges once its checks pass, also where the repository does not allow auto-merge (`merge` in the answer says `auto-armed`, `merged` or `watching`). Add `--draft` for a pull request a person should look at first; a draft is never armed to merge. Unless whoever started you said they publish for you: then you open nothing.

A pull request whose body has a line `Closes #<number>` closes that issue when it merges.

## Reading pull requests and issues

```
npx github requests [--branch <b>] [--state open|merged|all] [--since <iso>]
```

The project's pull requests, newest first: `number`, `url`, `state` (`open`, `merged`, `closed`), `title`, `draft`, `branch`, `head`, `createdAt`, `mergedAt`.

For a pull request's discussion and diff, and for the project's issues, use `gh` directly: `gh pr view <number> --comments`, `gh pr diff <number>`, `gh issue list`, `gh issue view <number> --comments`, `gh issue comment <number> --body "<text>"`. `gh` is installed and logged in where you run.

## Landing a pull request for a person

```
npx github merge <number>
```

A draft is marked ready, then the merge is armed as `--merge` arms it. Only when whoever started you asked you to land it.
