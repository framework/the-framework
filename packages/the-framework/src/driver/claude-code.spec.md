The Claude Code driver: `claude -p --output-format stream-json` per turn, plus the stream parser.

## Decisions

- Resume suppresses the appended system prompt — a resumed transcript already carries its framing; re-appending duplicates it.
- **Conversation-gone recovery**: a captured session id can outlive what the CLI will resume (retention, cleared history, another machine), and there is no way to ask first. The driver lets the turn fail once on the "no conversation found" error, emits a notice, and retries fresh — rather than losing the message the user already typed. Guarded so an abort is never mistaken for this.
- MCP servers ride a lazily written temp config file, deliberately **without** strict mode, so they merge with the user's own servers — this is how the browser tools are wired in.

## Facts

- The agent reports rate-limit resets in epoch seconds; the framework uses milliseconds — converted at this boundary.
- `dispose` only removes the temp MCP config dir; each prompt spawns and reaps its own process.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
