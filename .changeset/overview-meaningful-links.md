---
"@gemstack/the-framework": patch
---

Make the dashboard Overview's Human Queue and AI Queue links meaningful, or drop them.

The Human Queue's "Awaiting" and "Unpushed" rows now open the session they name — a run paused on a question, or one holding unpushed work — instead of landing on the project launcher, which is what their "Open the session" label always promised. The AI Queue's per-project header is no longer a link: it is a read-only "what's next" list, and a project name that jumped to the launcher was an odd redirect, so the header is plain text now; the work itself is opened from Hot tickets and Agents.
