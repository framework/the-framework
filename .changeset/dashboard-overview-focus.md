---
"@gemstack/the-framework": minor
---

Rework the dashboard Overview around what matters at a glance (#1139).

Usage moves to the top as the first thing you see. The two cross-project queues now sit side by side: a Human Queue ("Agents awaiting your approval, review, or input") and an AI Queue ("Tasks AI will work on next"), the latter showing every queued item in full as bullet points rather than collapsing to "+N more". A new Agents view lists the sessions working now and the ones just finished in two columns — Current and Recent — each row clickable straight into its session and dated in plain language ("22s ago", "2w ago") with the exact moment on hover. Hot tickets narrows to the three lanes worth surfacing — In progress, AI Queue (tickets an open `TODO_AGENTS.md` entry links to), and High priority — in a two-column layout.

The redundant cards are gone: the KPI tiles, run outcomes, the projects table, and the "Overview" title with its tagline. Session activity is removed for now, to return later.
