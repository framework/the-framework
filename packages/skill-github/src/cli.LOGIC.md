Gives an agent [1] in a shell, the user, the dashboard's server and the scheduler the `github` command over this package: `requests`, `open`, `merge`, `watch` and `home`, so one implementation serves every surface. The dashboard's server and the scheduler name no package: they run whichever command the project's `package.json` dependencies declare as the framework's git host provider [2], and this package declares its own `github` command. Every run prints one JSON document on stdout, at most one line for a person on stderr, and exits with a code that says how it went: 0 for a result, 1 for a refusal or a failure, 2 for a command line that could not be read.

## Context

**User story**: an agent runs `npx github open --title … --body …` after pushing, as its `github` skill instructs, and reads the request back. The dashboard's server runs `requests` to show a run's pull request and the Human Queue's open ones, `open` and `merge` when the user presses "Open PR" or "Merge PR", and `home` for the project bar's link; the scheduler runs `requests` to record a run's pull request and `merge` to land it once a follow-up run is done. A program parsing stdout learns the outcome and its reason; a person reading stderr learns why in one line.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] git host provider: the package among a project's dependencies whose `package.json` declares `"framework": { "git-host": "<command>" }`; the dashboard's server and the scheduler read and act on the project's pull requests by running that command, naming no package.

## Business logic — TL;DR

- **One JSON document, one line, an exit code** - the result or the refusal on stdout, the reason for a person on stderr, exit 0 for a result and 1 for a refusal or a failure; a failure no command expected (gh dying mid-call) is `git-host-failed` with its line.
- **A command line that cannot be read** - an unknown command, an unknown flag, a `--state` other than `open`, `merged` or `all`, a missing `--title`, an empty `--branch`, a pull request number that is not a positive integer, or the wrong argument count prints the usage on stderr, nothing on stdout, and exits 2.
- **Where a command acts** - on the repository the working directory is in, as gh finds it.
- **`requests`** - the pull requests matching `--branch`, `--state` and `--since`, as a bare JSON array; gh unable to answer is the refusal `git-host-failed` with gh's line ("the pull requests could not be read: …").
- **`open`** - the request of `--branch` or the current branch, with `--title`, `--body`, `--draft` and `--merge` as `open.ts` reads them; the refusals `no-branch`, `open-failed` and `merge-failed`, each with a line naming the branch or the request and gh's detail.
- **`merge <number>`** - lands the request as `merge.ts` does, answering `{ number, outcome }`; `not-open` with the request's state and `merge-failed` with the detail are refusals.
- **`watch <number>`** - runs the merge watcher in this process, its progress on stderr, the outcome on stdout, `ok` only when it merged.
- **`home`** - the project's page on GitHub and the git host's name; `no-remote` when `origin` is missing or on another host.
