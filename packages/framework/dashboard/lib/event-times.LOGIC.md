Records when each line of a live transcript reached the browser, so the transcript can show a clock time beside it. An event [1] carries no time of its own, so one is taken the moment the event arrives over the live stream. An event that was never live — one read back from a finished agent's [2] archive [3] — is never stamped, and its line shows no time at all rather than the time the page happened to be opened.

## Glossary

[1] event: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] archive: the transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.
