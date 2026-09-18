What the tests cover, for the transcript of an agent's [1] events [2]:

- **Conversation rows** - the user's prompt wears the "you" badge and the agent's reply the "agent" badge; a prompt's text renders inline; a reply renders as Markdown (bold text becomes bold, not literal asterisks); a message longer than 100 characters folds to its first line and offers "Expand message", while a short one renders whole with no fold control; a trailing block supplied by the caller renders inside the scrolling area, after the last row, rather than floating over it.
- **Row color** - the coding agent's [3] own error line and a failed end are red; a stopped end, a waiting end (which reads as waiting, never as failed) and a clean finish are not red; the user's own turn is blue.
- **Badge color** - a gate's [4] badge is amber while its question text keeps the plain tone; a clean end's badge is green and a stopped end's stays muted; a failed end's badge stays red, since failure wins over the kind's color.
- **Prompt placement** - the first prompt is hoisted above the session rows emitted before it; a later prompt stays where it happened, after the earlier exchange; a transcript with no prompt at all keeps its order, the session id row staying first.
- **Gates answered in the flow** - with a project known, an open gate renders as the interactive panel and clicking an option posts the pick [5] against that project, gate, option and agent; without a project the gate stays as text with no clickable option; a gate the agent ended on without an answer stays text; when a gate id fires twice only the latest firing offers its options.
- **A gate through a waiting end** - an agent that ended waiting on its question keeps the question answerable in the transcript; once the agent has gone on, the row is no longer an answerable panel.
- **Row wash** - the user's own turn is washed blue; a failed end is washed red; a clean end is washed green while a stopped end gets no wash; an ordinary reply from the agent gets no wash at all.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] event / event stream: everything an agent does, in order, read off the agent's diary: the file its tool writes one line at a time, in the agent's checkout while it has one and on the data branch once it is recorded; every surface is a projection of it.
[3] coding agent: the CLI doing the actual work: Claude Code or Codex.
[4] gate: a question with options an agent's turn ended on: the agent ends waiting for the answer, the dashboard shows the question as a card, and the answer resumes the agent.
[5] pick: the answer to a gate: the option or options the user chose.
