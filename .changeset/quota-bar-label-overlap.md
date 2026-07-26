---
'@gemstack/framework-dashboard': patch
---

Reworked the usage bar per #960: a single track split left-to-right into what's been used (solid) and the budget left for autonomous AI (dimmed, no rounded seam between them), with a round knob on the dimmed segment's edge to drag the limit — no day axis, just the bar, the boundary line, and the knob. The main figure now reads "Over-consuming: 1d" / "Under-consuming: 2h" instead of a percentage of the week — a plain duration naming how far ahead of or behind today's pace consumption actually is, with a tooltip explaining what it means; the caption also carries a "show all limits" tooltip — now a real table, so columns line up — with the session and any per-model windows. The legend and the enabled/disabled status share one row, with a "Past daily budget" warning between them once the knob is dragged past the boundary. The unrelated "spend what's left on the roadmap" toggle is removed from this panel.
