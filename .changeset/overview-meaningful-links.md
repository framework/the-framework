---
"@gemstack/the-framework": patch
---

Make the dashboard Overview's links meaningful, or drop them.

The Human Queue's "Awaiting" and "Unpushed" rows now open the session they name — a run paused on a question, or one holding unpushed work — instead of landing on the project launcher, which is what their "Open the session" label always promised. The AI Queue's per-project header and any Hot ticket that is not currently being implemented are no longer links: with no session to open and no ticket view to deep-link to, they only redirected to the project's new-session launcher, so they now read as the glanceable information they are. A Hot ticket a live run is implementing still opens that session.
