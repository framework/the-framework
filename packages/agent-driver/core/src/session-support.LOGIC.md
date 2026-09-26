Gives every driver session [1] the pieces that are not specific to any coding agent [2]: reporting progress events [3] without letting a listener break the coding agent, folding the driver session's stop request [4] with a turn's [5] own, folding the driver session's framing [6] with a turn's own, and reading a file out of the driver session's directory. A driver [7] implemented outside this package builds its progress events with the same reporter.

## Glossary

[1] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[2] coding agent: the CLI doing the actual work: Claude Code or Codex.
[3] progress event: what a driver reports while a turn runs, for a caller to show and never to decide on: the prompt sent, the session id, streamed text, a tool used, the final result, a rate limit reading, an error, a notice.
[4] stop request: the caller's signal that a driver session, or one turn of it, must end now; the product raises one when the user stops the agent.
[5] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[6] framing: the standing instructions a caller gives a driver session, plus any extra instructions for one turn; the driver delivers them as the coding agent's system prompt, or ahead of the prompt when the coding agent has no system prompt flag.
[7] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.

## Business logic — TL;DR

- **A listener can never break the coding agent** - a progress event [3] goes to the caller's listener when there is one; a listener that throws is logged with the driver's [7] name and ignored, and the turn [5] continues. Without a listener, reporting is a no-op.
- **Two stop requests, one list** - the driver session's [1] stop request [4] and the turn's own are combined, absent ones dropped, so a turn ends when either is raised.
- **Two framings, one block** - the driver session's framing [6] and the turn's extra framing are joined as separate paragraphs, with a blank line between them, empty ones dropped.
- **Reading produced code** - a path is read relative to the driver session's directory, as UTF-8 text; this is how the local drivers let the caller read a file the coding agent [2] produced.
