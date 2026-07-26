---
'@gemstack/framework-dashboard': patch
---

Reworked the usage bar per #960: day segments are now calendar days (local midnight to local midnight) rather than equal sevenths, so a label sits where most of that day actually falls — the account's own start day, split by a mid-day start into two same-named slivers, keeps its label on whichever is larger instead of showing twice. The bar splits left-to-right into what's been used (solid) and the room left before unattended work stops (dimmed), with no rounded seam between them; dragging the dimmed segment's own round knob sets the limit. Day separators are wider, the caption now names when the week resets (with a full-date tooltip) instead of a generic tone note, a warning appears once the limit is dragged past the daily boundary, and the legend explains the boundary line with a tooltip. The unrelated "spend what's left on the roadmap" toggle and its status line are removed from this panel.
