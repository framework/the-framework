The session's log [1]: two files at a directory the caller gives, written as the agent [2] works, in the shape of a run record: the card (`<id>.json`), what the run is and how it stands, and the diary (`<id>.jsonl`), one line per thing that happened. A dashboard reads them while the agent runs; a runner copies them onto its records when the run ends, unchanged. The shape is data, stated here, so that a runner and a dashboard agree on it without either importing the other.

## Context

**User story**: the user opens a running agent's page and sees what it said so far, what it cost, its branch and its status; when the run ends, the same lines are its record.

**Business logic story**: a driver session started with a log directory and a starting card records every progress event [3] before it reaches the caller's listener; the caller patches the card with what it learns later (the branch, the pull request, its own mark) and ends the log with the run's status, and may reopen an ended log to send the same session more turns.

## Glossary

[1] log: the card and the diary of one driver session, at the directory the caller gave.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch.
[3] progress event: what a driver reports while a turn runs: the prompt sent, the session id, streamed text, a tool used, the final result, a rate limit reading, an error, a notice, a question.

## Business logic — TL;DR

- **The card** - `id`, `startedAt`, `status` (`running` until ended, then `done`, `stopped`, `failed` or `waiting`), `endedAt`, `intent`, `driver`, `model`, `branch`, `pr`, `cost` (dollars, summed from the turns that priced themselves), and `caller`, one key for whatever the caller keeps (its own mark, the pid; the session id is added here as soon as the coding agent names it).
- **The diary** - `said` for streamed text, `result` for a turn's final text, `cost` (`usd`) after a priced turn, `question` for the question a turn ended on, `ended` with the status and a detail, and every other progress event as a line of its own kind (`start`, `session`, `action`, `rate-limit`, `error`, `notice`).
- **Opening, patching, ending, reopening** - the directory is made, the card written and the diary emptied when the session starts, or kept and continued when the caller says the log continues an earlier session's; a patch adds or changes card fields, merging into `caller`; the end appends the `ended` line and sets the status and the end time; a reopen, for more turns of the same session after the end, sets the card back to `running` and removes its end time, while the diary keeps its `ended` line and the turns that follow are appended after it, as a resumed run's are; every write is queued in order and a failed write never breaks the run.
