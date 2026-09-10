Picks the driver [1] implementation for an agent [2] from its location [3], on top of the user's driver choice: an agent whose location is `actions` runs on the GitHub Actions driver, one whose location is `web` on the cloud driver that hands the task to a cloud session [4], and any other agent, `local` or with no location given, on the driver for the chosen coding agent [5] (the choice between Claude Code and Codex is `driver-cli.ts`'s). It is the one place where an agent's location becomes a real driver, and it is kept apart from the coding-agent choice so that GitHub configuration never rides on a local agent.

## Glossary

[1] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude` or `codex`; the driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[4] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[5] coding agent: the CLI doing the actual work: Claude Code or Codex.

## Business logic — TL;DR

- **`actions` needs the runner's configuration** - the GitHub Actions driver is built from the repository's owner and name, a GitHub token and the workflow to dispatch; without that configuration the agent is refused with "run target "actions" needs the repo owner/repo and a GitHub token; set a GitHub origin remote and GH_TOKEN".
- **`web` needs nothing of The Framework's** - the cloud driver is built with defaults for every setting, because the coding agent's own CLI already holds the account the cloud session is signed in with, the same account the local driver runs on.
- **Anything else is the chosen coding agent's driver** - `local`, or no location at all, falls through to the driver for the user's driver choice, unchanged by this file.
