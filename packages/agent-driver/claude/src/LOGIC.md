Claude Code as a driver [1] of the `agent-driver` contract on this machine, the reader of the account's quota [2], the lister of the models Claude Code offers, and the package's entry point.

## Glossary

[1] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[2] quota: the account's subscription allowance, as Claude Code reports it: a session window and a quota week, each with a percentage used.

## Business logic — TL;DR

- **Claude Code on this machine** (`claude-code.ts`, `claude-code.test.ts`) - one non-interactive `claude` invocation per turn with framing as the system prompt, text, tool names, session id, usage and rate limit readings read off its streamed JSON, the driver session continued and revived through Claude Code's own resume, and a vanished conversation retried once as a fresh turn; each part of the person's own setup that is off turned into Claude Code's own switch; the readiness check with Claude Code's login question. The output reader is exported for `@openagt/agent-driver-github-actions`, which reads a runner's transcript with it.
- **The account's quota** (`claude-code-quota.ts`, `claude-code-quota.test.ts`) - Claude Code's own usage readout parsed into windows with a percentage each, and every empty reading named by a reason that says whether the attempt failed or the login has no quota [2].
- **The models Claude Code offers** (`claude-code-models.ts`, `claude-code-models.test.ts`) - Claude Code's own `/model` list, asked through its `initialize` request with no prompt, its "default" entry left out.
- **The entry point** (`index.ts`) - the driver with its session, output parser and option types, the readiness check, the quota reader and the model lister.
