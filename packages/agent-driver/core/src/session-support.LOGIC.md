Gives every driver session [1] the pieces that are not specific to any coding agent [2]: reporting progress events [3] without letting a listener break the coding agent, folding the driver session's stop request [4] with a turn's [5] own, folding the driver session's framing [6] with a turn's own, and reading a file out of the driver session's directory. A driver [7] implemented outside this package builds its progress events with the same reporter.

## Glossary

[1] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[2] coding agent: the CLI doing the actual work: Claude Code or Codex.
[3] progress event: what a driver reports while a turn runs, for a caller to show and never to decide on: the prompt sent, the session id, streamed text, a thought, a tool used, what the tool gave back, the final result, a rate limit reading, an error, a notice.
[4] stop request: the caller's signal that a driver session, or one turn of it, must end now; the product raises one when the user stops the agent.
[5] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[6] framing: the standing instructions a caller gives a driver session, plus any extra instructions for one turn; the driver delivers them apart from the prompt when the coding agent takes such instructions (Claude Code's system prompt, Codex's developer instructions), or ahead of the prompt when it does not.
[7] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.

## Business logic — TL;DR

- **A listener can never break the coding agent** - a progress event [3] goes to the caller's listener when there is one; a listener that throws is logged with the driver's [7] name and ignored, and the turn [5] continues. Without a listener, reporting is a no-op.
- **A prompt and the sentence added after it** - what the coding agent is sent is the prompt and, when the caller added a sentence, that sentence after an empty line; the `start` progress event [3] carries the prompt as the caller gave it and names the sentence apart, so a reader can show who said what.
- **Two stop requests, one list** - the driver session's [1] stop request [4] and the turn's own are combined, absent ones dropped, so a turn ends when either is raised.
- **Two framings, one block** - the driver session's framing [6] and the turn's extra framing are joined as separate paragraphs, with a blank line between them, empty ones dropped.
- **A tool call's detail on one line** - the detail a driver puts on a tool call is flattened to one line (runs of whitespace become one space) and cut to 200 characters, the last one an ellipsis, so a long command or prompt never floods the diary.
- **A tool call's output, cut to a size limit** - what a tool call printed is kept whole, without its blank end, when it is at most 4000 characters. A longer one keeps its first 2000 characters and its last 2000, with one line between them saying how many characters were cut ("… 1003 characters cut …"): the start says what ran, the end says how it went, and a run of many calls stays a small diary.
- **A tool call's argument, short and whole** - the one argument that says what a call did is given as the detail (one line, cut to 200 characters) and, only when that line is not all of it (a command of several lines, or a long one), also whole, lines kept, cut as an output is. A missing or blank argument gives neither.
- **How many lines a text holds** - a last line with no line break counts as a line; an empty text holds none. This is how a driver [7] sizes a file a tool call created.
- **How many lines a patch adds and removes** - of a patch's lines, one that starts with `+` is added and one that starts with `-` is removed; a context line is neither. The rest of the line does not matter: a removed line whose own text starts with `--` (a markdown rule, a comment) is a removed line. This is how a driver sizes a file a tool call changed.
- **The lines of a unified diff's hunks** - a unified diff opens with file headers, which read like a removed and an added line: its hunks' lines are all that follows its first `@@` line. A text whose first line is neither a hunk's `@@` line nor a header is no diff, even when a later line of it reads like one.
- **Reading produced code** - a path is read relative to the driver session's directory, as UTF-8 text; this is how the local drivers let the caller read a file the coding agent [2] produced.
