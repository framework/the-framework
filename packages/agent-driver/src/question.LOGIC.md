The question [1]: the one block an agent [2] ends a turn [3] with when it will not decide alone, and its one parser. Every driver [4] reports the question a turn ended on the same way, so a dashboard shows one card and a runner takes the recommended option unattended, whichever coding agent is behind the driver. The words that teach an agent when to ask are the caller's (a skill file, a system prompt); this file says what a question is.

## Context

**User story**: the agent has written a plan and wants it signed off, or hit a login wall in its browser, or sees two ways to go; it ends its turn with the question and its options; the dashboard shows it as a card with the recommended option preselected; nobody there means the recommended option is taken.

**Business logic story**: the driver session (`inbox.ts`, at every turn's end) runs the parser over the turn's final message and reports the result as the `question` progress event [5]; the log (`session-log.ts`) writes it as a diary line; the answer comes back through the inbox [6] as a continuation prompt whose wording is this file's.

## Glossary

[1] question: a fenced block tagged `await-choices` ending a turn's final message: a title, the options (label, one-liner, `stop`, `default`), the recommended option, `multi`, an optional file.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch.
[3] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[4] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[5] progress event: what a driver reports while a turn runs, for a caller to show and never to decide on.
[6] inbox: the file of lines from outside the agent (messages, answers) the driver sends into the session when a turn ends.

## Business logic — TL;DR

- **The block** - JSON in a fenced block tagged `await-choices`: `title`, `options` with `label`, `detail`, `stop` (the answer ends the session instead of resuming the agent) and `default` (starts checked), `recommended` (a label or an id), `multi`, `file`.
- **Parsing, tolerant** - the last usable block in the final message wins, skipping a malformed one for an earlier good one; an option without a label is dropped; an id is made from the position (`opt:0`) when the agent names none; a blank title reads `Which option?`; a recommended label maps to its option's id and an unknown one is dropped; a block with no pickable option, or no block at all, is no question.
- **The continuation prompt** - the answer resumes the agent with one wording for every caller: `You paused to ask: "<title>". The user chose: <answer>. Continue with that decision.`, nothing more.
