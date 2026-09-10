Checks, before a checkout [1] is spent on an agent [2], that the chosen driver's [3] coding agent [4] can start one: its command is found and answers its version, and it is logged in. When the handoff [5] arms a pull request, it also checks whether `gh` is installed and logged in, and it always notices when the daemon runs as root. A missing or logged-out coding agent fails preflight [6] with the command that fixes it; a missing or logged-out `gh`, and running as root, are warnings that never block. Node needs no check: preflight runs on it and reports its version.

## Context

**User story**: the user presses Start and is told at once that `claude` is not installed, or is logged out and which command fixes it, instead of finding a spent branch and a dashboard stuck on "Waiting for the session to start...". The launcher shows the problems before the Start, and the daemon refuses a start with the same lines.

**Problem**: installed is not the same as usable. A coding agent that resolves fine but is logged out dies before its first turn, on every agent, across every project, while the daemon goes on spending a branch and a checkout per attempt with a log that says nothing about why. The usual cause is a daemon started with `sudo`: it moves `HOME`, so the coding agent looks for its credentials under root's home and finds none.

## Glossary

[1] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] driver: a coding agent wrapped as a black box. The user's driver choice is `claude` or `codex`.
[4] coding agent: the CLI doing the actual work: Claude Code or Codex.
[5] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local`, `push`, `pr` (also open a pull request — the default), `merge` (also merge it).
[6] preflight: the check that the chosen driver's coding agent can start an agent, run before a checkout is spent.

## Business logic — TL;DR

- **The driver that was picked** - preflight checks the coding agent of the chosen driver, `claude` by default, so a Codex agent fails on `codex` being missing rather than on `claude`; the Node version is always the first, passing check.
- **Installed** - the command must be found and answer `--version` within ten seconds; otherwise the check fails with "`<command>` not found — <install hint>".
- **Logged in** - an installed coding agent is asked whether it is logged in; only an explicit no fails, an explicit yes passes as "logged in", a coding agent that will not say adds nothing, and the question is skipped when the command is missing.
- **The GitHub CLI, when a pull request is armed** - `gh` missing or logged out is a warning naming the fix, never a failure, and `gh` is not probed otherwise.
- **Running as root** - a warning naming the user to restart the daemon as, never a failure.
- **What the user is told** - preflight passes when no check fails, warnings notwithstanding; the problems are the failing checks, one line each as "<check>: <detail>".

## Business logic

### The driver that was picked

#### Context

**Problem**: a check that always probed `claude` would fail a Codex agent for the wrong reason, or pass it with Codex missing.

#### Business logic

Preflight [6] checks the coding agent [4] of the chosen driver [3]: `claude` for Claude Code, `codex` for Codex, `claude` when no driver is given. What preflight knows about each, the command on PATH, the install hint, the login question and the fix, is the table in `driver-cli.ts`. Every check runs its command with a ten-second limit and reads its standard output and standard error together, because the two coding agents disagree about where a status line belongs. The first check is always Node, passing, with the running version as its detail.

### Installed

#### Context

See `## Context`.

#### Business logic

The command is asked for `--version`. When it answers, the check named after the driver [3] passes with the version it printed as its detail, or "installed" when it printed nothing. When it cannot be found or fails, the check fails with the detail "`<command>` not found — <install hint>", the hint being the driver's own, which names where to get the coding agent [4] and that the command must be on PATH.

### Logged in

#### Context

**Problem**: the exit code cannot say whether a coding agent [4] is logged in, and a wrong "you are logged out" would block a setup that works, which is worse than the silent dead agent [2] the check exists to prevent.

#### Business logic

Only when the command was found, preflight [6] asks it the driver's [3] login question and reads the answer by the driver's rules in `driver-cli.ts`, which yield yes, no, or "could not say". An explicit no fails a check named "<driver> auth" with the detail "`<command>` is not logged in. Run `<fix>`, then start the session again.", the fix being `claude auth login` or `codex login`. An explicit yes passes that check with the detail "logged in". "Could not say", as from an older coding agent that does not know the question and prints its usage instead, adds no check at all: an agent that might work is worth more than a warning nobody can stand behind. When the command is missing the question is not asked: one "not found" beats two lines saying the same thing.

### The GitHub CLI, when a pull request is armed

#### Context

**User story**: the user starts an agent whose handoff [5] will open or merge a pull request; hours later, at the finish, the pull request is opened through the GitHub CLI. A missing or logged-out `gh` should be said at the Start, not discovered as a handoff that silently stopped at the pushed branch.

#### Business logic

Only when the caller says a pull request is armed, `gh` is asked for `--version` and then for `gh auth status`. A `gh` that is not found adds a passing check marked as a warning, "gh", with the detail "`gh` not found — the armed PR cannot be opened, so publishing stops at the pushed branch. Install the GitHub CLI (`brew install gh`, or https://cli.github.com) and run `gh auth login`.". A `gh` whose `auth status` fails, which it does when no host is logged in, adds a warning check "gh auth" with the detail "`gh` is not logged in — the armed PR cannot be opened, so publishing stops at the pushed branch. Run `gh auth login`, then start the session.". The exit code alone decides the login answer. An installed, logged-in `gh` adds nothing. These are warnings because the agent's [2] own work needs no `gh` and the push level of the handoff is plain git, so the agent is worth starting either way. Without an armed pull request, `gh` is not checked at all.

### Running as root

#### Context

**Problem**: a daemon started with `sudo` fails every agent [2] identically and silently, because the coding agent [4] looks for credentials under root's home. A container legitimately runs everything as root, so refusing to start there would break more than it explains.

#### Business logic

When the daemon's process runs as root (on Windows, which has no user id, it never counts as root), a passing check marked as a warning, "root", is added with the detail "running as root, so the agent looks for credentials under root's home and will not find yours. Restart the daemon as <user>, without `sudo`.", where the user is the one `sudo` recorded in the environment, quoted, or "your own user" when there is none.

### What the user is told

#### Context

**Business logic story**: the daemon runs preflight [6] before starting an agent [2] on this machine and refuses the start with the problems joined by "; ", caching only a pass and only briefly, so that logging in is picked up by the very next Start (`daemon-runtime.ts`). The launcher asks for the same check before the Start and shows the problems and the warnings, never the passing checks' details, which have no business reaching a browser that may be a relay guest (`dashboard-rpc/projects.ts`).

#### Business logic

Preflight passes when every check passes; a warning is a passing check with a note, so it never blocks. The problems are the failing checks only, one line each in the form "<check name>: <detail>", which is how the user is told what to fix.
