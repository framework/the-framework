Preflight checks for a live agent: before an agent starts, verify its prerequisites so a missing one fails early with the exact fix, instead of a broken process dying mid-run after the daemon has already spent a branch and a worktree. Only live agents are gated; a fake driver needs none of this.

## Business logic — TL;DR

- **The picked driver must be installed and logged in** - the driver the agent will actually run on is probed; missing or logged-out fails the preflight with that driver's own install or login command.
- **Failures block, warnings travel** - the overall verdict counts failures only; warnings ride along without stopping the start.
- **PR publishing gets a heads-up, not a veto** - when the agent's handoff will open or merge a PR, a missing or logged-out GitHub CLI (`gh`) warns with install/login guidance but never blocks.
- **Root is called out** - a daemon running as root (usually via `sudo`) warns that the driver will look for credentials in the wrong home, naming the user to restart as.

## Business logic

### The picked driver must be installed and logged in

#### User story

The user starts an agent. If the driver CLI is missing — or installed but logged out — every agent dies before producing anything, with a log that says nothing about why. The user needs the one command that fixes it, at Start time.

#### Business logic

The driver the agent actually picked is probed, not always the default one: a Codex agent is checked against `codex` and a failure points at the Codex install, not the Claude Code one. The probe asks the CLI for its version; a CLI that does not resolve is a failure whose detail carries that driver's install instructions. When the CLI resolves, it is additionally asked whether it is logged in, in that driver's own way — a definite "no" is a failure whose detail names the driver's login command ("run it, then start the session again"). Only a definite "no" fails: a CLI that will not say (an older version without the subcommand) is treated as unknown, because an agent that might work is worth more than a warning nobody can stand behind. The login question is skipped entirely when the CLI is missing — one "not found" beats two lines saying the same thing. The probe reads the CLI's combined output streams, because the two drivers disagree about where a status line belongs. A check reporting that Node runs (with its version) is always included.

#### Rationale

Installed is not the same as usable: the first external-user report was a CLI that resolved fine but was logged out, under a daemon started with `sudo` — every agent died before writing its agent meta, across six projects, while the daemon kept spending a branch and a worktree per attempt.

### Failures block, warnings travel

#### Business logic

Each check reports pass/fail plus a human-readable detail (the version when passing, the fix when not); some passing checks additionally carry a warning. The overall verdict is "no failures" — warnings never block. A separate summary lists only the failures, one `name: fix` line each, which is what the user is told to correct; warnings are deliberately absent from it.

### PR publishing gets a heads-up, not a veto

#### User story

The agent's handoff level is `pr` or `merge`. Opening and merging the PR happens through the GitHub CLI hours after the Start that could have said it will not work.

#### Business logic

When asked to check publishing, preflight also probes `gh`: not installed, or installed but not logged in, produces a warning telling the user publishing will stop at the pushed branch, with install and `gh auth login` guidance. It is a warning, never a failure: the agent's own work needs no `gh`, and the push rung of the handoff is plain git, so the agent is worth starting either way. A healthy `gh` adds nothing to the result, and `gh` is not probed at all when no publishing rung asks for it.

### Root is called out

#### Business logic

When the daemon runs as root, a warning explains that the driver will look for credentials under root's home and not find the user's, and says to restart the daemon without `sudo` — naming the invoking user `sudo` recorded when it is known. A warning, not a failure, because a container legitimately runs everything as root and refusing to start there would break more than it explains. (Windows has no user id and never counts as root.)

#### Rationale

`sudo` moves the home directory, so the driver CLI reads root's credentials, finds none, and every agent dies identically with an empty log — a failure that says nothing at all about its cause, which is why it is named here at Start time.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
