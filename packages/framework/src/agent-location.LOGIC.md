Fixes the location [1] axis of an agent [2]: the three locations `local`, `actions` and `web`, the check that a value arriving from the browser or from the repo file [3] names one of them, and which location is hands-off [4]. Only `web` is hands-off: a cloud session [5] opens its own pull request and never reports back to this machine, so the agent's first prompt is the whole agent. An `actions` agent streams its coding agent [6]'s own replies from the GitHub Actions runner, so it is followed turn by turn like a `local` one. Where an agent runs is a fact about the agent, not about the driver [7]: the driver only says which coding agent to spawn.

## Glossary

[1] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] the repo file: `the-framework.yml` at a project's root: per-repo defaults that travel with the code.
[4] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.
[5] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[6] coding agent: the CLI doing the actual work: Claude Code or Codex.
[7] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[8] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[9] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.

## Business logic — TL;DR

- **Three locations** - `local` (this machine), `actions` (a GitHub Actions runner) and `web` (a Claude Code cloud session); a value that is not one of these three, wherever it arrives from (the location saved in the preferences [8], an agent's options), is not a location and is dropped, so no unknown location ever reaches an agent.
- **Only `web` is hands-off** - a `web` agent's opening prompt is the whole agent, and everything an agent would do after it (work the agent queue [9], stay open for messages) is dropped rather than fed the driver's own "handed off" note as if the agent had written it; `local` and `actions` agents are followed to the end.
