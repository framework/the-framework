A driver [1] for tests and offline demos that never starts a process and never calls a model: it answers each turn [2] from a script, or from a responder given the prompt, and reports the same progress events [3] a real driver does, so the whole product can run with no coding agent [4] installed. Its implementation id is `fake`.

## Glossary

[1] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude` or `codex`; the driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[2] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[3] progress event: what a driver reports while a turn runs, for a caller to show and never to decide on: the prompt sent, the session id, streamed text, a tool used, the final result, a rate limit reading, an error, a notice.
[4] coding agent: the CLI doing the actual work: Claude Code or Codex.
[5] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[6] usage: what one turn spent, as the coding agent reports it: token counts, and a notional price in US dollars when the coding agent prices its turns.
[7] stop request: the caller's signal that a driver session, or one turn of it, must end now; the product raises one when the user stops the agent.
[8] framing: the standing instructions a caller gives a driver session, plus any extra instructions for one turn; the driver delivers them as the coding agent's system prompt, or ahead of the prompt when the coding agent has no system prompt flag.

## Business logic — TL;DR

- **Scripted turns, in order** - the driver session [5] answers its turns [2] from the scripted turns in order and repeats the last one once they run out, so a short script never starves a long agent; with no script at all, every turn answers with an empty final message. Each scripted turn carries the final message, optionally the tool names to show and the usage [6] to report.
- **A responder wins over the script** - when a responder is configured, each turn's answer is whatever it returns for the prompt and the turn's index, as a full scripted turn or as bare text.
- **The same progress events as a real driver** - a turn reports `start` with the prompt, one `action` per scripted tool name, `text` when the final message is not empty, and `result` with the final message, the driver session's id (`fake-session` unless configured) and the usage when scripted; the turn answers with the same final message, session id and usage.
- **Every prompt is recorded** - the driver session keeps every prompt it received, in order, for a test to check what the product asked.
- **Seeded files** - reading produced code answers from the files the driver was seeded with, by exact path; any other path is refused ("fake driver has no file <path>").
- **A stop request fails the turn** - a stop request [7] already raised on the driver session or on the turn fails the turn ("fake prompt aborted") before any progress event is reported. Framing [8], the model, and every request to continue an earlier conversation are ignored; there is no quota reading, and ending the driver session frees nothing.
