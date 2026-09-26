Claude Code as a driver [1] of the `agent-driver` contract, on this machine and on a GitHub Actions runner, the reader of the account's quota [2], and the package's entry point. The GitHub Actions driver reads Claude Code's streamed output with the same parser as the local one, which is why both live here.

## Glossary

[1] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[2] quota: the account's subscription allowance, as Claude Code reports it: a session window and a quota week, each with a percentage used.
[3] correlation id: the id the `github-actions` driver makes up for one turn and hands the workflow, which echoes it into the run's display name and the artifact's name; it is the only way the driver finds its own run.

## Business logic — TL;DR

- **Claude Code on this machine** (`claude-code.ts`, `claude-code.test.ts`) - one non-interactive `claude` invocation per turn with framing as the system prompt, text, tool names, session id, usage and rate limit readings read off its streamed JSON, the driver session continued and revived through Claude Code's own resume, and a vanished conversation retried once as a fresh turn; each part of the person's own setup that is off turned into Claude Code's own switch; the readiness check with Claude Code's login question.
- **The account's quota** (`claude-code-quota.ts`, `claude-code-quota.test.ts`) - Claude Code's own usage readout parsed into windows with a percentage each, and every empty reading named by a reason that says whether the attempt failed or the login has no quota [2].
- **Claude Code on a GitHub Actions runner** (`actions.ts`, `actions.test.ts`) - each turn dispatches the agent workflow with the prompt as an input, finds its run by a correlation id [3], waits up to 1 hour, reads the transcript back from the run's artifact and replays it in a burst; continuity across turns is one branch the driver names and every run pushes to. The runner holds no personal setup, so there is nothing to turn off.
- **Reading a run's artifact** (`actions-zip.ts`, `actions-zip.test.ts`) - the zip archive GitHub hands back is read entry by entry and refused outright when it is not an archive, never read short.
- **The entry point** (`index.ts`) - both drivers with their parsers and option types, the readiness check and the quota reader; the zip reader stays internal.
