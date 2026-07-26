---
'@gemstack/framework-dashboard': patch
---

Reworked the usage bar per #960: a single track split left-to-right into what's been used (solid) and the budget left for autonomous AI (dimmed, no rounded seam between them), with a round knob on the dimmed segment's edge to drag the limit — no day axis, just the bar, the boundary line, and the knob. The caption names when the week resets and, when there's more than the account's own week to show, a "show all limits" tooltip with the session and any per-model windows. The legend and the enabled/disabled status share one row, with a "Past daily budget" warning between them once the knob is dragged past the boundary. The unrelated "spend what's left on the roadmap" toggle is removed from this panel.
