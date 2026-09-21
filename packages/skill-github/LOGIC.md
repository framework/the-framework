The `github` skill [1]: the project's forge [2] is GitHub, and this package is the only place that speaks to it. It is three things at once: the instructions an agent [3] reads (`SKILL.md`), the `github` command every agent runs through `npx` to open its pull request once its branch is pushed (`bin/`, `src/cli.ts`), and the forge provider [4] the dashboard's server and the scheduler run for every question about pull requests: which ones the project has, open one, land one, where the project's page is. `gh`, GitHub's own command line, runs here and nowhere else; another forge is another package answering the same command, and neither the dashboard nor the scheduler names one. `package.json` and the `tsconfig*.json` files configure the package, its build and its tests, `dist/` and `dist-test/` are build output, and `DECISIONS.md` records the decisions the code implements; none of them carries business logic of its own.

## Context

**User story**: an agent finishes its work, pushes its branch as its branches skill says, then runs `npx github open --title … --body …` and the user finds a pull request open for it; with `--merge`, the request lands by itself once its checks pass. The dashboard shows a run's pull request, the Human Queue's open requests and the "Open on GitHub" link, and its "Open PR" and "Merge PR" buttons work, all through this one command, so a project on another forge swaps the package and nothing else.

## Glossary

[1] skill: one of the capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs`, `github` — each a package with the instructions the agent reads (its `SKILL.md`), a command on the agent's PATH, and, for some, a command the product runs.
[2] forge: the service hosting the project's remote repository, its pull requests and its issues: GitHub here.
[3] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[4] forge provider: the package among a project's dependencies whose `package.json` declares `"framework": { "forge": "<command>" }`; the dashboard's server and the scheduler read and act on the project's pull requests by running that command, naming no package.

## Business logic — TL;DR

- **What the agent is told** (`SKILL.md`) - once its branch is pushed it opens the pull request with `npx github open`, `--merge` when the work may land on its own, `--draft` for one a person should look at first, unless whoever started it publishes for it; `Closes #<n>` in a body closes an issue; pull requests are read with `npx github requests`, their discussion and the issues with `gh` directly; `merge <number>` lands one for a person only when asked.
- **The command** (`src/`) - `requests`, `open`, `merge`, `watch`, `home`, one JSON document each, which the agent runs in its shell and the dashboard's server and the scheduler run as the forge provider [4].
- **The executable** (`bin/`) - the `github` file the package registers as the command.
