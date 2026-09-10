What the tests cover, for the transcript of an agent's [1] events [2]:

- **Conversation rows** - the user's prompt wears the "you" badge and the agent's reply the "agent" badge; a prompt's text renders inline; a reply renders as Markdown (bold text becomes bold, not literal asterisks); a message longer than 100 characters folds to its first line and offers "Expand message", while a short one renders whole with no fold control; a trailing block supplied by the caller renders inside the scrolling area, after the last row, rather than floating over it.
- **Row color** - the coding agent's [3] own error line, an error the agent reported itself, and a failed end are red; a stopped end and a clean finish are not red; the user's own turn is blue.
- **Badge color** - a gate's [4] badge is amber while its question text keeps the plain tone; a clean end's badge is green and a stopped end's stays muted; a failed end's badge stays red, since failure wins over the kind's color; a pushed view's [5] badge and a browser row's badge take the primary accent.
- **Prompt placement** - the first prompt is hoisted above the session and system-prompt rows emitted before it; a later prompt stays where it happened, after the earlier exchange; a transcript with no prompt at all keeps its order, the system prompt row staying first.
- **Gates answered in the flow** - with a project known, an open gate renders as the interactive panel and clicking an option posts the pick [6] against that project, gate, option and agent, as the user's; without a project the gate stays as text with no clickable option; an answered gate collapses to a folded line that hides its "✓ chose" row and is no longer answerable, and clicking the folded line reveals the options that were offered; a gate the agent ended on without an answer stays text; when a gate id fires twice only the latest firing offers its options.
- **The browser preview in the flow** - with a project and agent known, only the newest browser row hosts the preview image ("The agent's browser") and an earlier browser row keeps its "◆ browser: <url>" line; a repeated URL replaces its earlier row instead of adding one; after the agent ends, a preview that captured no frame degrades to the "browser · <url>" line; with a project but no agent every browser row stays text; a browser row's badge takes the primary accent.
- **Row wash** - the user's own turn is washed blue; an error the agent reported and a failed end are washed red; a clean end is washed green while a stopped end gets no wash; an ordinary reply from the agent gets no wash at all.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] event / event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[3] coding agent: the CLI doing the actual work: Claude Code or Codex.
[4] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.
[5] view: a markdown document an agent pushes to the dashboard's right rail while it works.
[6] pick: the answer to a gate: the option or options chosen, by the user or automatically.
