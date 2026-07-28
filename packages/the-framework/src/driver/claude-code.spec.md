The first real `Driver`: wraps the Claude Code CLI in print mode (`claude -p --output-format stream-json`), one fresh non-interactive invocation per prompt, streaming its JSON events and returning the final `result` as the turn.

## TLDR

- `ClaudeCodeDriver.start` boots a `ClaudeCodeSession`; `readQuota` delegates to `readClaudeQuota` (account-wide, no session).
- `ClaudeCodeSession.prompt` builds argv, runs it through `runAgentCli` with a `StreamJsonParser`, and tracks the agent's own session id so `resume: true` prompts pass `--resume <id>` (#714) and a finished run can be revived via `resumeSessionId` (#720).
- `StreamJsonParser` folds the NDJSON dialect: assistant text → `text` events, `tool_use` → `action` (name only), `rate_limit_event` → `rate-limit` (#517), `result` line → final text + usage (#322).
- Optional per-session MCP servers (#452) are written to a lazily-created temp `--mcp-config` file (merged with the user's own servers — no `--strict-mcp-config`), removed on `dispose`.

## Problems

- Resuming a session id the CLI no longer has (retention, cleared history, another machine, #778): there is no way to ask first, so it lets the run fail once, matches the `No conversation found with session ID` message, drops the id, emits a `notice`, and retries fresh — rather than losing the message the user typed.
- On resume the system framing is deliberately NOT re-appended: the resumed transcript already carries it, and re-appending duplicates it (the fresh retry gets it back).

## Decisions

- Default permission mode `acceptEdits` so file writes are non-interactive; `bypassPermissions` / `--dangerously-skip-permissions` only for fully autonomous sandboxes.
- `parseUsage` omits `costUsd` when there is no price, never writes 0: the budget gate reads 0 as "free" and undefined as "unknown" (#540).
- `parseRateLimit` converts the agent's epoch seconds to millis (the rest of the framework speaks millis) and returns undefined on malformed payloads rather than reporting a bogus reset.
- Parser kept separate from process plumbing so it is unit-testable; `ActionsDriver` reuses it verbatim on the workflow transcript.

## Flows

- prompt: combineFraming → buildArgs (`-p --output-format stream-json --verbose`, permission flags, `--resume`|`--append-system-prompt`, `--model`, `--mcp-config`, extraArgs) → runAgentCli(StreamJsonParser) → on conversation-gone: clear id, notice, rerun fresh → record turn.sessionId.
