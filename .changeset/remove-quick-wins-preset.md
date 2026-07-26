---
"@gemstack/the-framework": minor
---

Remove the [Quick wins] preset (#773). It harvested `.plan.md` companions and appended the quick ones to `TODO_AGENTS.md`, a step the triage pair ([Do quick-win work] / [Do consensual work], #891/#892) already covers by reading `tickets/*.md` directly — so the auto-PM rotation now triages straight from tickets rather than harvesting an intermediate plan first, and the launcher no longer offers the button.
