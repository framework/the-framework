The inbox [1]: what reaches a running agent [2] from outside, and the end of every turn [3]. A file at a path the caller gives, one JSON line per message or answer; whoever shows the agent appends lines; the driver session reads them when a turn ends and sends each as the next prompt of the same session, in order, until the file is empty, then the prompt resolves and the run ends. Nothing waits for a line that may never come: a later line is for a new session resumed by its id.

## Context

**User story**: while a scheduled agent works, the user types "also add a test" on its page, or answers the question it stopped on; the agent gets it as its next turn, in the same conversation, and the user never had to keep a process alive for it.

**Business logic story**: a dashboard or a runner appends to the inbox (`appendInbox`); each driver's `prompt` ends with the shared turn end (`finishTurn`): the question [4] the turn ended on is reported (`question.ts`), then the inbox is drained; the runner records the turn through the log (`session-log.ts`).

## Glossary

[1] inbox: a file of JSON lines, `{"kind":"message","text":…}` or `{"kind":"answer","question":…,"answer":…}`, at a path the caller gives a prompt.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch.
[3] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[4] question: the block an agent ends a turn with when it will not decide alone; see `question.LOGIC.md`.

## Business logic — TL;DR

- **Two kinds of line** - a message (the user's words, non-empty) and an answer (the question's title and the chosen label or labels); anything else, a torn line included, is skipped.
- **Taking the lines** - the file is renamed aside in one step, read, and removed: a line appended meanwhile lands in a fresh inbox for the next take, so none is lost or read twice; no inbox is no lines.
- **The end of every turn** - the question the turn ended on, when there is one, is reported as the `question` progress event; when the prompt named an inbox, every waiting line becomes the next prompt of the same session, continuing the previous turn, in order, a message as its text and an answer as the continuation prompt; when the inbox is empty the prompt resolves with the last turn. Every driver shares this end.
