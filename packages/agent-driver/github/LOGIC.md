The `@agent-driver/github` package: a coding agent [1] on a GitHub Actions runner behind the `agent-driver` contract (`../core`): each turn is one run of the project's agent workflow, and what the coding agent did is read back from the run and replayed. Claude Code today, its transcript read with `@agent-driver/claude`'s output reader; Codex would need its own workflow step and its own reader. The workflow itself is `.github/workflows/framework-agent.yml`. `package.json`, `tsconfig.json`, `tsconfig.build.json` and `tsconfig.test.json` configure the build and the test runner and carry no business logic; `dist/` and `dist-test/` are build output; each source file's `*.BUG-ANALYSIS.md` records when it was last reviewed for bugs.

## Context

**User story**: the user has an agent's turns run on GitHub's runners instead of this machine; the agent view shows what the coding agent did once each run ends.

**Business logic story**: what a place needs is the same whichever coding agent runs there: start the run, find it, wait for it, read the result back. So the place is its own package, and the coding agent is what the workflow runs and which reader reads its transcript. The runner is a fresh machine holding none of the person's own setup, so this driver takes no personal setup option.

## Glossary

[1] coding agent: the CLI doing the actual work: Claude Code or Codex.

## Business logic — TL;DR

- **A coding agent on a GitHub Actions runner** (`src/`) - each turn dispatches the agent workflow, finds its run, waits up to 1 hour, reads the transcript back from the run's artifact and replays it in a burst; told in `src/LOGIC.md`.
