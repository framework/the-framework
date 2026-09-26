The `@agent-driver/codex` package: Codex behind the `agent-driver` contract (`packages/agent-driver`), on this machine. The runner (`packages/agent-runner`) runs a run's Codex through it. `package.json`, `tsconfig.json`, `tsconfig.build.json` and `tsconfig.test.json` configure the build and the test runner and carry no business logic; `dist/` and `dist-test/` are build output; each source file's `*.BUG-ANALYSIS.md` records when it was last reviewed for bugs.

## Context

**User story**: the user picks `codex` as an agent's driver; the agent view shows what Codex says and does and the tokens it spent, and a run leaves the user's own Codex setup out unless their machine turns a part of it on.

**Business logic story**: one adapter per coding agent, each its own package on one contract, so a caller installs the coding agents it drives and nothing else. This one is Codex's: its command line, its output, its switches for the person's own setup, and the questions that tell whether it can start.

## Business logic — TL;DR

- **Codex on this machine** (`src/`) - one `codex` process per turn, its streamed output read, its conversation resumed; the person's own setup turned off part by part, the skills through a Codex home of its own; whether `codex` is installed and logged in, and which personal skills it cannot keep out; told in `src/LOGIC.md`.
