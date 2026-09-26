The driver family: one contract for driving a coding agent [1] as a black box, and one package per driver [2] on it, all under this folder. A driver is a coding agent on this machine, a shared place that runs any coding agent's CLI, or one vendor's own cloud.

## Context

**Business logic story**: two things vary independently: which coding agent [1] works (Claude Code, Codex) and where it runs (this machine, a GitHub Actions runner, the vendor's cloud). What depends on the coding agent is its command line, the reader of its output, its switches for the person's own setup and its login question; what depends on the place is how a turn reaches it and comes back. A shared place such as a GitHub Actions runner runs the coding agent's own CLI, so one package serves every coding agent and takes each one's output reader from its package. A vendor's own cloud (Claude Code on claude.ai, Codex cloud) is that vendor's site with its own login and its own way in, so each is a package of its own.

| | this machine | a GitHub Actions runner | the vendor's cloud |
|---|---|---|---|
| Claude Code | `claude/` | `github-actions/` | Claude Code in a cloud session, still in the product (`packages/framework`) |
| Codex | `codex/` | not yet | not yet |

## Glossary

[1] coding agent: the CLI doing the actual work: Claude Code or Codex.
[2] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.

## Business logic — TL;DR

- **The contract** (`core/`) - the `agent-driver` npm package: what every driver [2] promises, the three parts of the person's own setup every local driver takes, the pieces every driver shares, the readiness check each driver feeds its own CLI questions, and a scripted fake; told in `core/LOGIC.md`.
- **Claude Code on this machine** (`claude/`) - the `@agent-driver/claude` npm package: Claude Code as a driver, its output reader, its switches for the person's own setup, whether `claude` can start, and the account's quota; told in `claude/LOGIC.md`.
- **Codex on this machine** (`codex/`) - the `@agent-driver/codex` npm package: Codex as a driver, its switches for the person's own setup through a Codex home of its own, and whether `codex` can start; told in `codex/LOGIC.md`.
- **A coding agent on a GitHub Actions runner** (`github-actions/`) - the `@agent-driver/github-actions` npm package: each turn one run of the project's agent workflow, its transcript read back and replayed; Claude Code today, read with `@agent-driver/claude`'s output reader; told in `github-actions/LOGIC.md`.
