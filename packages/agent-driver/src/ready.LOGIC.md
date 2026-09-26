Asks a coding agent's [1] CLI whether a session can start on this machine at all, before a run spends a checkout on it: the CLI is installed, and it is logged in. The answer is a list of problems, which stop a run, and a list of warnings, which are said and stop nothing; each line names its own fix. The questions are the adapter's: each adapter (`@agent-driver/claude`, `@agent-driver/codex`) hands in its CLI's binary, install page, login question, how to read the answer, and its login command, and adds warnings of its own.

## Context

**User story**: the user picks Claude Code or Codex in the dashboard's launcher; a CLI that is missing or logged out is said under the prompt box before the Start, with the command that fixes it, and a run started anyway is refused before it creates anything, instead of dying before its first turn [2] with nothing to say why.

**Business logic story**: installed is not the same as usable. A CLI that resolves fine and is logged out starts, and every session dies before its first turn. The runner (`packages/agent-runner`, `readyToRun`) passes the adapter's answer on as it is, and its `check` command, its person-started run and the scheduler's tick all ask it.

**Problem**: a wrong "you are logged out" would block a setup that works, which is worse than the dead session this exists to prevent. So only a CLI that says no out loud is a problem; an answer that cannot be read passes.

## Glossary

[1] coding agent: the CLI doing the actual work: Claude Code or Codex.
[2] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.

## Business logic — TL;DR

- **Installed** - the CLI (the adapter's binary, or the one the caller names) answers `--version`; when it does not, the one problem is "`<bin>` not found — <the adapter's install fix>", and the login is not asked.
- **Logged in** - the CLI is asked the adapter's login question and the adapter reads the answer as yes, no, or could not say; a no is the problem "`<bin>` is not logged in. Run `<the adapter's login command>`, then start again."; yes and could not say pass.
- **Root** - a process running as root gets a warning, not a problem: the coding agent would look for its credentials in root's home; the warning names the user `sudo` recorded, or "your own user".
- **The probe** - each question runs the binary on `PATH` with ten seconds at most, and reads standard output and standard error together, since CLIs disagree about where a status line goes; a caller can hand in its own probe.

## Business logic

### Installed, then logged in

#### Context

See `## Context`: the answer is asked before a run spends a checkout.

#### Business logic

The CLI is asked `--version` first. When that fails (the binary is not on `PATH`, exits non-zero, or does not answer within ten seconds), the answer has one problem, "`<bin>` not found — " followed by the adapter's install fix, and the login question is not asked: one "not found" beats two lines saying the same thing.

When the CLI answers, it is asked the adapter's login question, and the adapter's reader turns the answer into yes, no, or could not say. Only a no is a problem: "`<bin>` is not logged in. Run `<login command>`, then start again." Yes and "could not say" add nothing. How Claude Code and Codex answer is told in each adapter's `LOGIC.md`.

### Root

#### Context

**Problem**: under `sudo` the coding agent looks for its credentials in root's home, finds none, and every session dies alike, saying nothing about why. But a container legitimately runs everything as root, so refusing there would break more than it explains.

#### Business logic

When this process runs as root (Windows is never root by this test), the answer carries the warning "running as root, so the coding agent looks for credentials under root's home and will not find yours. Run it as `<user>`, without `sudo`.", with the user from `SUDO_USER`, or "your own user" when none is recorded. It is a warning whatever the CLI answered.
