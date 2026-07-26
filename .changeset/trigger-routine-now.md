---
'@gemstack/the-framework': minor
---

Adds `Trigger routine now` beside the Routine work card's `Auto-run` box, so a sweep can be fired on demand instead of waiting out the interval. The loop could always do this — it is what switching the preference on already triggers — but nothing could ask for it directly, so the only way to fast-forward was to tick the box off and on again. The button works with auto-run off too: that preference is consent to spend quota *unasked*, and clicking is asking, so the daemon runs one sweep — every other stand-down reason (live runs, cooldowns, the quota boundary, unticked routines) still in force — and the schedule stays off.
