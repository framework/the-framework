---
'@gemstack/framework': minor
---

Dashboard: the session log reads like a conversation. Your prompt is its own `YOU` row and the agent's turn is `AGENT`, so a message is no longer echoed twice — the redundant `You: …` log line is gone and the first prompt and every follow-up now read the same way.

Both your prompts and the agent's replies render as Markdown (headings, bold, lists, code, links), at the log's own density. A short message renders inline; a long one collapses to its first line with a chevron and expands in place on click, so the log stays scannable without hiding the text.

Also: the sessions rail's home row is now "New session" (a launcher) instead of "Live", and a session's id is always offered for copy in the toolbar (the exact string `--resume` takes), beside the existing copy-branch action.
