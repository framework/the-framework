Asks a coding agent's [1] CLI whether a session can start on this machine at all, before a run spends a checkout on it: the CLI is installed, and it is logged in. The answer is a list of problems, which stop a run, and a list of warnings, which are said and stop nothing; each line names its own fix. Only the local coding agents are asked: `claude-code` and `codex`.

## Context

**User story**: the user picks Claude Code or Codex in the dashboard's launcher; a CLI that is missing or logged out is said under the prompt box before the Start, with the command that fixes it, and a run started anyway is refused before it creates anything, instead of dying before its first turn [2] with nothing to say why.

**Business logic story**: installed is not the same as usable. A CLI that resolves fine and is logged out starts, and every session dies before its first turn. The runner (`packages/agent-runner`, `readyToRun`) passes this answer on as it is, and its `check` command, its person-started run and the scheduler's tick all ask it.

**Problem**: a wrong "you are logged out" would block a setup that works, which is worse than the dead session this exists to prevent. So only a CLI that says no out loud is a problem; an answer that cannot be read passes.

## Glossary

[1] coding agent: the CLI doing the actual work: Claude Code or Codex.
[2] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.

## Business logic — TL;DR

- **Installed** - the CLI (`claude` or `codex`, or the binary the caller names) answers `--version`; when it does not, the one problem is "`<bin>` not found — install …", with the coding agent's install page, and the login is not asked.
- **Logged in** - Claude Code is asked `auth status` and its JSON `loggedIn` flag is the answer; Codex is asked `login status` and "Not logged in" is no, "Logged in" is yes; a no is the problem "`<bin>` is not logged in. Run `claude auth login` (or `codex login`), then start again."; any other answer passes.
- **Root** - a process running as root gets a warning, not a problem: the coding agent would look for its credentials in root's home; the warning names the user `sudo` recorded, or "your own user".
- **The probe** - each question runs the binary on `PATH` with ten seconds at most, and reads standard output and standard error together, since the two CLIs disagree about where a status line goes; a caller can hand in its own probe.

## Business logic

### Installed, then logged in

#### Context

See `## Context`: the answer is asked before a run spends a checkout.

#### Business logic

The CLI is asked `--version` first. When that fails (the binary is not on `PATH`, or exits non-zero), the answer has one problem, "`claude` not found — install Claude Code and make sure `claude` is on your PATH: https://claude.com/claude-code" (for Codex: "`codex` not found — install the Codex CLI and make sure `codex` is on your PATH: https://developers.openai.com/codex/cli"), and the login question is not asked: one "not found" beats two lines saying the same thing.

When the CLI answers, it is asked about its login. Claude Code prints JSON and exits 0 whether logged in or not, so its `loggedIn` flag is the answer and the exit code is not; output that is not JSON with a true/false `loggedIn` (an older CLI printing its usage) is "could not say". Codex answers in a sentence: "not logged in" (any case) is no, checked first because it contains the positive; "logged in" is yes; anything else is "could not say". Only a no is a problem: "`<bin>` is not logged in. Run `claude auth login`, then start again." (Codex: `codex login`). Yes and "could not say" add nothing.

### Root

#### Context

**Problem**: under `sudo` the coding agent looks for its credentials in root's home, finds none, and every session dies alike, saying nothing about why. But a container legitimately runs everything as root, so refusing there would break more than it explains.

#### Business logic

When this process runs as root (Windows is never root by this test), the answer carries the warning "running as root, so the coding agent looks for credentials under root's home and will not find yours. Run it as `<user>`, without `sudo`.", with the user from `SUDO_USER`, or "your own user" when none is recorded. It is a warning whatever the CLI answered.
