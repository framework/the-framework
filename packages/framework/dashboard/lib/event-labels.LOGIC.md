Gives every line of an agent's [1] transcript the small word shown beside it, so a reader seeing the dashboard for the first time can tell what a line is. Four kinds of event [2] whose own names are internal are relabeled: the coding agent's [3] own turn [4] reads "agent", an agent parking on the user reads "waiting", spend so far reads "cost", and the line carrying the session id and the link that reopens the conversation reads "resume". Every other kind is shown under its own name with hyphens turned into spaces, so "system-prompt" reads "system prompt" and "ready-for-merge" reads "ready for merge", and a single-word name is shown as it is. The labels are written in lower case because the badge is drawn in capitals.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] event: everything an agent does, in order, read off the agent's diary: the file its tool writes one line at a time, in the agent's checkout while it has one and on the data branch once it is recorded; every surface is a projection of it.
[3] coding agent: the CLI doing the actual work: Claude Code or Codex.
[4] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
