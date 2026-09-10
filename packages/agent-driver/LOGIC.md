The `agent-driver` package is how The Framework works a repository without ever calling a model itself: it wraps a coding agent [1] the user already pays for as a driver [2], a black box started in a directory, prompted for one turn [3] at a time, streamed as progress events [4] and resumed later, and ships the implementations of that contract for Claude Code on this machine, Codex on this machine, Claude Code on a GitHub Actions runner, and a scripted fake for tests and offline demos. The product's agent [5] lifecycle in `packages/framework` speaks only this contract, which is what lets it add Claude Code in a cloud session [6] as a fifth implementation and swap one coding agent for another without changing anything above. `package.json`, `tsconfig.json`, `tsconfig.build.json` and `tsconfig.test.json` configure the build and the test runner and carry no business logic; `dist/` and `dist-test/` are build output; each source file's `*.BUG-ANALYSIS.md` records when it was last reviewed for bugs.

## Context

**User story**: the user picks `claude` or `codex` as an agent's [5] driver [2] and where its turns [3] run; the agent view shows what the coding agent [1] says and does and what it spent, the dashboard shows the account's quota [7] for Claude Code, and stopping the agent leaves nothing of the coding agent running.

**Business logic story**: every implementation runs on the user's own login to the coding agent [1], a subscription in the normal case, or on the OAuth token the repository holds for a runner; The Framework holds no model key. The seam is the prompt, the final message and the code left behind, never the coding agent's tool calls: a turn [3] succeeds on the process's exit code or the run's conclusion, and the caller shows the progress events [4] but never decides on them.

## Glossary

[1] coding agent: the CLI doing the actual work: Claude Code or Codex.
[2] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude` or `codex`; the driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[3] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[4] progress event: what a driver reports while a turn runs, for a caller to show and never to decide on: the prompt sent, the session id, streamed text, a tool used, the final result, a rate limit reading, an error, a notice.
[5] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[6] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[7] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.

## Business logic — TL;DR

- **The driver seam and its implementations** (`src/`) - the contract every driver [2] honors, the process core shared by the local implementations with its stop and reaping rules, the Claude Code, Codex, GitHub Actions and fake implementations, and the reader of Claude Code's quota [7]; told in `src/LOGIC.md`.
