---
'@gemstack/framework-dashboard': patch
---

Reworked the usage bar per #960: a single track split left-to-right into what's been used (solid) and the budget left for autonomous AI (dimmed, no rounded seam between them), with a round knob on the dimmed segment's edge to drag the limit — no day axis, just the bar, the boundary line, and the knob. The main figure now reads consumption against the *daily* budget rather than the week (it can run negative, e.g. -260%, when well behind pace), with a tooltip explaining what it means; the caption also carries a "show all limits" tooltip — now a real table, so columns line up — with the session and any per-model windows. The legend and the enabled/disabled status share one row, with a "Past daily budget" warning between them once the knob is dragged past the boundary. The unrelated "spend what's left on the roadmap" toggle is removed from this panel.
