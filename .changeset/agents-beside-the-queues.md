---
"@gemstack/the-framework": minor
---

Rework the Overview's Agents card around the sessions working right now.

The Recent column is gone — finished sessions already live in the sidebar's session list, so the card kept only the live half — and with it the per-column "Current" eyebrow: "Agents currently working" now reads as a one-liner right next to the card's title. The card also moves up from its slot below Routine work to sit beside the Human Queue, on top of the AI Queue, so what needs you, who is on it, and what the AI takes up next share one row. `DashboardData.recentAgents`, which existed only to feed the removed column, is dropped from the dashboard payload.
