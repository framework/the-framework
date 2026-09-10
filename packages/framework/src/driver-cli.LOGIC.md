What the daemon knows about each driver's [1] coding agent [2] before it runs an agent [3] — the command to find on PATH, what to tell the user when it is missing, how to ask the coding agent whether it is logged in and the one command that fixes a logged-out one — and the step that turns the user's driver choice (`claude` or `codex`) into the live driver implementation for an agent that runs on this machine. The names themselves are fixed in `driver-names.ts`; where an agent runs (`actions`, `web`) is decided in `target-driver.ts`.

## Context

**User story**: when the user starts an agent, preflight [4] tells them up front that `claude` (or `codex`) is not installed, or is not logged in and which command fixes it, instead of spending a checkout [5] on an agent that dies at its first turn.

## Glossary

[1] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude` or `codex`; the driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[2] coding agent: the CLI doing the actual work: Claude Code or Codex.
[3] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[4] preflight: the check that the chosen driver's coding agent can start an agent, run before a checkout is spent.
[5] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.

## Business logic — TL;DR

- **What preflight knows about each driver** - the command on PATH (`claude`, `codex`), the install hint shown when it is not found, and the command that fixes a logged-out coding agent (`claude auth login`, `codex login`).
- **Reading the login answer** - each coding agent's own output decides, never the exit code; only an explicit "not logged in" counts as no, and anything unreadable counts as "could not say".
- **Turning the choice into a driver** - `claude` builds the Claude Code driver with the Claude options; `codex` builds the Codex driver with none of them, and Claude options passed for Codex are dropped and reported.

## Business logic

### What preflight knows about each driver

#### Context

See `## Context`.

#### Business logic

Each driver [1] carries: its label ("Claude Code", "Codex"); the command preflight [4] resolves on PATH (`claude`, `codex`); the hint shown when it is not found ("install Claude Code and make sure `claude` is on your PATH: https://claude.com/claude-code", "install the Codex CLI and make sure `codex` is on your PATH: https://developers.openai.com/codex/cli"); the arguments that make the coding agent [2] report its login state (`claude auth status`, `codex login status`); and the one command that fixes a logged-out coding agent (`claude auth login`, `codex login`). When each check runs and what the user sees is preflight's own flow, in `preflight.ts`.

### Reading the login answer

#### Context

**Problem**: the exit code cannot decide whether a coding agent is logged in: Claude Code prints its answer as JSON and exits successfully either way. A wrong "you are logged out" blocks a setup that works, which is worse than the silent dead agent the check exists to prevent.

#### Business logic

Each coding agent [2] reads its own answer out of its output, and the answer is yes, no, or "could not say":

- Claude Code prints JSON with a logged-in flag, and that flag is the answer. Output that is not that JSON reads as "could not say"; a version too old to know the subcommand prints its usage instead, which is exactly this case.
- Codex answers in a sentence: "Not logged in" is no; otherwise a sentence containing "logged in" is yes; anything else is "could not say". The negative is tested first, because it contains the positive as a substring.

Only an explicit no fails preflight [4]; "could not say" lets the agent [3] start.

### Turning the choice into a driver

#### Context

**Problem**: the two coding agents do not take the same options. Codex's sandbox is its own flag rather than a permission mode, and it has no MCP configuration for the browser option.

#### Business logic

For an agent [3] that runs on this machine, the driver [1] choice becomes the live implementation in one place: `codex` builds the Codex driver with no options; `claude` builds the Claude Code driver with the Claude options the caller assembled (the permission mode, MCP servers such as the browser's, extra arguments, the environment). Options that only Claude Code understands are dropped for Codex here, and the caller reports that to the user, so a flag that cannot apply says so rather than looking honored. How each driver turns those options into its command line belongs to the `agent-driver` package.
