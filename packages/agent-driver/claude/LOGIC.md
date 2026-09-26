The `@agent-driver/claude` package: Claude Code behind the `agent-driver` contract (`../core`), on this machine; plus the reader of the account's quota [1]. Its output reader is also what `@agent-driver/github-actions` (`../github-actions`) reads Claude Code's transcript with on a runner. The runner (`packages/agent-runner`) runs a run's Claude Code through it, and the scheduler (`packages/agent-scheduler`) and the product (`packages/framework`) read the quota through it. `package.json`, `tsconfig.json`, `tsconfig.build.json` and `tsconfig.test.json` configure the build and the test runner and carry no business logic; `dist/` and `dist-test/` are build output; each source file's `*.BUG-ANALYSIS.md` records when it was last reviewed for bugs.

## Context

**User story**: the user picks `claude` as an agent's driver; the agent view shows what Claude Code says and does, what it spent and where the account's quota [1] stands, and a run leaves the user's own Claude Code setup out unless their machine turns a part of it on.

**Business logic story**: one adapter per coding agent, each its own package on one contract, so a caller installs the coding agents it drives and nothing else. This one is Claude Code's: its command line, its output, its switches for the person's own setup, and the questions that tell whether it can start.

## Glossary

[1] quota: the account's subscription allowance, as Claude Code reports it: a session window and a quota week, each with a percentage used.

## Business logic — TL;DR

- **Claude Code on this machine** (`src/`) - one `claude` process per turn, its streamed output read, its conversation resumed; the person's own setup turned off part by part; whether `claude` is installed and logged in; and the account's quota [1]; told in `src/LOGIC.md`.
