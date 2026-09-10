Drives Claude Code as a driver [1]: each turn [2] is one non-interactive invocation of the `claude` command in the driver session's [3] directory, whose streamed JSON output is read for the coding agent's [4] text, tool names, session id, usage [5] and rate limit [6] readings, and whose final message is the turn's answer. The driver session is continued across turns, and revived after the agent [7] ends, through Claude Code's own resume; the account's quota [8] is read through `claude-code-quota.ts`. Its implementation id is `claude-code`.

## Context

**User story**:
- The user picks Claude Code as the driver [1] and starts an agent [7]; the agent view shows what Claude Code says and which tools it uses, turn [2] by turn.
- The user sends a live chat [9] message to a running agent, and it lands in the same conversation with everything Claude Code already knows.
- The user revives a finished agent, and its first prompt continues where the earlier conversation left off.
- The user picks a model for the agent; the dashboard shows the account's quota [8].

**Business logic story**: Claude Code runs on the user's own login, a subscription in the normal case. The Framework holds no model key and passes none: Claude Code authenticates itself, keeps its own loop and its own tools, and The Framework only prompts it and reads what comes back. Running the process, deciding success on its exit code, stopping it and reaping its process tree are the rules of `cli-session.ts`, shared with the Codex driver.

## Glossary

[1] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[2] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[3] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[4] coding agent: the CLI doing the actual work: Claude Code or Codex.
[5] usage: what one turn spent, as the coding agent reports it: token counts, and a notional price in US dollars when the coding agent prices its turns.
[6] rate limit: the coding agent's per-turn reading of whether the account may still spend against one quota window, and when that window resets.
[7] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[8] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[9] live chat: the user's own messages to a running agent, each continuing the same driver session. One of them is a message.
[10] framing: the standing instructions a caller gives a driver session, plus any extra instructions for one turn; the driver delivers them as the coding agent's system prompt, or ahead of the prompt when the coding agent has no system prompt flag.
[11] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[12] stop request: the caller's signal that a driver session, or one turn of it, must end now; the product raises one when the user stops the agent.
[13] progress event: what a driver reports while a turn runs, for a caller to show and never to decide on: the prompt sent, the session id, streamed text, a tool used, the final result, a rate limit reading, an error, a notice.

## Business logic — TL;DR

- **Starting and prompting Claude Code** - every turn [2] spawns `claude` in print mode with streamed JSON output, in the driver session's [3] directory, with the prompt over standard input.
- **Permission mode** - Claude Code runs with `acceptEdits` unless the driver [1] was configured with another mode, or told to skip permission checks altogether; the product itself chooses `bypassPermissions`.
- **Framing becomes the system prompt** - the driver session's framing [10] and the turn's extra framing are appended to Claude Code's system prompt, except on a resumed turn, whose conversation already carries them.
- **Model pass-through** - the model the caller names is passed to Claude Code as is; without one, Claude Code's own default runs.
- **MCP servers** - servers the driver was configured with are written once per driver session to a temporary configuration file that Claude Code merges with the user's own, and removed when the driver session ends.
- **Continuing the driver session** - the session id of each completed turn is kept; a turn asked to continue resumes it, a driver session seeded with an earlier session id resumes that one on its first such turn, and with nothing to resume the turn runs fresh.
- **When the conversation to resume is gone** - a resume Claude Code refuses because it no longer has that conversation is retried once as a fresh turn, with a notice to the user, and the dead session id is dropped.
- **What is read off the streamed output** - the session id on its first sighting, text and tool names as they stream, and the final result line as the turn's answer, with everything else ignored.
- **Usage off the result line** - token counts, and the price only when Claude Code reports one, never zero.
- **Rate limit telemetry** - each rate-limit line becomes a rate limit [6] reading with its status and window passed through verbatim and its reset time converted to milliseconds; a malformed line stays silent.
- **Reading the account's quota** - the driver reads the quota [8] through `claude-code-quota.ts`, with the same command and environment it runs turns with.
- **Ending the driver session** - only the temporary MCP configuration is freed; each turn's process is already gone when the turn ends.

## Business logic

### Starting and prompting Claude Code

#### Context

See `## Context`.

#### Business logic

Every turn [2] spawns the `claude` command, found on `PATH` unless the driver [1] was configured with another command, as one non-interactive invocation: print mode with streamed JSON output, verbose so that every message is streamed (`-p --output-format stream-json --verbose`). It runs in the driver session's [3] directory, the agent's [7] checkout [11], with the environment of The Framework's own process unless the driver was configured with another. The prompt is fed over standard input, so a long prompt never hits the command-line length limit. Extra command-line arguments the driver was configured with are appended verbatim, last. Spawning, streaming, the exit code, the stop request [12] and the reaping of the process tree follow `cli-session.ts`: a non-zero exit fails the turn even when text streamed first.

### Permission mode

#### Context

**Problem**: a turn [2] in print mode cannot answer an interactive approval, so any permission Claude Code would ask for is silently denied. The mode decides what a coding agent [4] nobody can answer for may do without asking.

#### Business logic

Unless told otherwise, Claude Code runs with the `acceptEdits` permission mode, so file writes need no approval; installs, builds and tests still would, and are denied. The driver [1] can be configured with `bypassPermissions` for a fully autonomous agent [7] that also installs and runs things, with `plan`, or with `default`. Configured to skip permission checks altogether, the driver passes `--dangerously-skip-permissions` instead of a permission mode; that is meant only for a sandbox with no network. The product's own choice for every agent is `bypassPermissions` (`packages/framework/src/cli.ts`).

### Framing becomes the system prompt

#### Context

**Business logic story**: the product's standing instructions for an agent [7] reach Claude Code as framing [10]; a resumed conversation already carries them.

#### Business logic

The driver session's [3] framing [10] and the turn's [2] extra framing are joined as separate paragraphs and appended to Claude Code's own system prompt (`--append-system-prompt`), so Claude Code's defaults stay and the instructions come on top. A turn that resumes an earlier conversation does not append them again: the resumed conversation already carries its framing, and re-appending would only duplicate it. A turn with no framing at all appends nothing.

### Model pass-through

#### Context

**User story**: the user picks a model for an agent [7] in the launcher.

#### Business logic

When the caller names a model, it is passed to Claude Code as is (`--model <id>`); the driver [1] neither validates nor substitutes it. Without one, Claude Code runs whatever model it defaults to.

### MCP servers

#### Context

**User story**: the user starts an agent [7] with a browser; the browser reaches Claude Code as an MCP server (`packages/framework/src/browser.ts`).

#### Business logic

MCP servers the driver [1] was configured with (each a command, its arguments and its environment) are written to a temporary configuration file, `mcp.json` in a fresh `agent-driver-mcp-` directory under the operating system's temporary directory, the first time a turn [2] of the driver session [3] needs it; every later turn of the driver session reuses the same file. The file is passed with `--mcp-config` and not marked strict, so these servers merge with the user's own configured MCP servers instead of replacing them. With no servers configured, no file is written and no flag is passed.

### Continuing the driver session

#### Context

**User story**: the user chats with a running agent [7], and each live chat [9] message continues the same conversation; the user revives a finished agent, and its opening prompt continues the conversation it had.

#### Business logic

The driver session [3] keeps the session id Claude Code reported for its last completed turn [2]. A turn asked to continue the previous turn passes that id to Claude Code (`--resume <session id>`), so the message lands in the same conversation with its full context; consecutive live chat [9] messages chain because Claude Code keeps the id stable across resumes. A driver session started with the session id of an earlier driver session treats it as the last known id, so its very first turn, when asked to continue, resumes that earlier conversation. A turn asked to continue when no session id is known runs as a fresh turn, framing [10] included, which is the normal case for an agent's [7] opening prompt. A turn not asked to continue always runs fresh, whatever ids are known.

### When the conversation to resume is gone

#### Context

**Problem**: the session id The Framework kept can outlive what Claude Code will resume: Claude Code's retention, a cleared history, another machine. There is no way to ask first, and the user has already typed the message, which must not be lost.

#### Business logic

When a resumed turn [2] fails and Claude Code's answer says it has no conversation with that session id ("No conversation found with session ID"), the driver [1] forgets the dead session id, tells the user through a `notice` progress event [13] ("That conversation is no longer available; continuing without its history."), and sends the same prompt again as a fresh turn, this time with the framing [10] the resume had skipped. The first attempt's `error` progress event is held back until it is known whether the retry happens, so a turn that recovers never shows a failed row; the retry's own `start` progress event is swallowed, so the user's message appears once. Later turns asked to continue chain off the new conversation. There is no retry when a stop request [12] was raised, when the turn was not a resume, or when the failure is anything else; then the held `error` progress event is reported and the turn fails.

### What is read off the streamed output

#### Context

**User story**: the agent view shows Claude Code's text and the tools it uses while the turn [2] runs, and the turn's final message when it settles.

#### Business logic

Claude Code streams one JSON object per line. A line that is not JSON, or is a JSON value that is not an object, is noise and is ignored. From each object:

- A session id, on its first sighting and whenever it changes, becomes a `session` progress event [13] ahead of everything else on that line. It is announced on the very first line rather than held for the result, so a turn [2] that is stopped or dies mid-flight still leaves the handle needed to resume the driver session [3]. A repeated id is not announced again.
- An assistant message yields one `text` progress event per text block, which is also accumulated, and one `action` progress event per tool use, carrying the tool's name only.
- A rate-limit line yields a `rate-limit` progress event (see "Rate limit telemetry").
- The result line's text is the turn's final message, and its usage [5] is the turn's usage. The `result` progress event itself is reported by `cli-session.ts` once the process has exited successfully, not by the parser.

When the process ends with no result line, the accumulated assistant text stands in as the turn's text.

### Usage off the result line

#### Context

**User story**: the dashboard shows what an agent [7] cost.

#### Business logic

The result line's price becomes the usage [5] price only when it is a finite number; otherwise the price is omitted, never reported as zero, since a spending gate reads zero as free and absent as unknown. The token counts come from the result line's usage object: input, output, cache read and cache created; a missing or non-numeric count reads as zero. A result line with neither a price nor a usage object yields no usage at all.

### Rate limit telemetry

#### Context

**Business logic story**: Claude Code emits one rate limit [6] line per turn [2], so the account's standing is free telemetry: no extra call, no polling.

#### Business logic

A rate-limit line becomes a rate limit [6] reading carrying its status and its window exactly as Claude Code names them, and its reset time converted from the seconds Claude Code reports to milliseconds. A status or window never seen before passes through untouched: an unknown value is the signal worth capturing. A line missing the status, the window or a numeric reset time yields nothing, since reporting a bogus reset is worse than reporting none. Telemetry never disturbs the turn [2] itself.

### Reading the account's quota

#### Context

**User story**: the dashboard shows the account's quota [8].

#### Business logic

On request, the driver [1] reads where the account's quota [8] stands through the reader in `claude-code-quota.ts`, with the same command, environment and process spawner it runs turns [2] with, and with the caller's stop request [12]. The reading is account-wide and needs no driver session [3].

### Ending the driver session

#### Context

See `## Context`.

#### Business logic

Ending a driver session [3] removes the temporary MCP configuration directory, if one was written, and nothing else: each turn's [2] process is spawned and reaped by that turn, so nothing durable is left to end. A removal that fails is ignored, since the directory lives under the operating system's temporary directory and is reaped with it. Ending twice is safe.
