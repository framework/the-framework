Implements the `github` skill [1]: everything the product and an agent [2] ask of GitHub, the project's forge [3], behind one command. `gh`, GitHub's command line, runs only here (`gh.ts`). The command (`cli.ts`) answers five things: the project's pull requests as one read (`requests.ts`), opening a branch's pull request with the merge armed on request (`open.ts`), landing a pull request (`merge.ts`), waiting for a pull request's checks and merging it where the repository allows no auto-merge (`merge-watch.ts`), and the project's page on GitHub (`home.ts`). The `*.BUG-ANALYSIS.md` notes beside the sources, when present, are review bookkeeping and carry no business logic.

## Context

**User story**: an agent pushes its branch and runs `npx github open`; the user finds the pull request open, merged on green when the agent was allowed to land it. The dashboard's server runs the same command to list the project's pull requests, to open and land one when the user presses "Open PR" or "Merge PR", and to link to the project on GitHub; the scheduler runs it to read a run's pull request into its record and to land it once a follow-up run is done.

## Glossary

[1] skill: one of the capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs`, `github` — each a package with the instructions the agent reads (its `SKILL.md`), a command on the agent's PATH, and, for some, a command the product runs.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[3] forge: the service hosting the project's remote repository, its pull requests and its issues: GitHub here.
[4] merge watcher: a process of this package's own, started for one pull request, that waits for its checks and merges it once they pass (`merge-watch.ts`).

## Business logic — TL;DR

- **Running gh** (`gh.ts`) - one runner, `gh` on PATH with a minute per call, rejecting with gh's own line; every other file takes it as a parameter, so a test scripts GitHub's answers.
- **The pull requests as one read** (`requests.ts`) - a branch's, the open ones, the ones merged since a time: one gh listing of at most 50, each request in one shape with its state lowercased; a read gh cannot answer throws, so "none" and "could not tell" never look alike.
- **Opening a pull request** (`open.ts`) - for the current branch or a named one, with the caller's title and body; a branch with an open request gets no second one; a draft only when asked and never with an armed merge; `--merge` arms the merge on green.
- **Landing a pull request** (`merge.ts`) - GitHub's auto-merge by squash where allowed (`auto-armed`), merged at once where GitHub says the request is already green (`merged`), the merge watcher [4] where the repository allows no auto-merge (`watching`), any other refusal said with gh's line; `merge <number>` marks a draft ready first and refuses a request no longer open.
- **The merge watcher** (`merge-watch.ts`) - reads the request every minute, merges it by squash when its checks pass, leaves a red one open, gives up after six hours; its own detached process, started as `github watch <number>`.
- **The project's page** (`home.ts`) - `https://github.com/<owner>/<repo>` derived from the `origin` remote in its scp, ssh or https form; none for another host.
- **The command** (`cli.ts`) - `requests`, `open`, `merge`, `watch`, `home`: one JSON document on stdout, one line for a person on stderr, exit 0 for a result, 1 for a refusal or a failure, 2 for a command line that could not be read.
- **The entry point** (`index.ts`) - what a caller's code imports.
- **The tests** (`requests.test.ts`, `open.test.ts`, `merge-watch.test.ts`, `home.test.ts`, `cli.test.ts`) - each command against a scripted gh, and the watcher against a scripted clock.
