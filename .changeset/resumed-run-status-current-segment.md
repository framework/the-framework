---
'@gemstack/framework-dashboard': patch
---

A resumed session reads as running again: `isRunActive` and `runOutcome` now fold over the current `session` segment instead of the whole feed. The resume fix keeps the full multi-segment transcript on screen, which exposed the stopped segment's `end` event to the status folds — the pill stayed yellow "stopped" and the ⋮ menu hid "Stop session" while the resumed agent was live, and a resumed run that later finished clean would have stayed "stopped" for ever.
