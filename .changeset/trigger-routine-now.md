---
'@gemstack/the-framework': minor
---

Adds `Trigger routine now` beside the Routine work card's `Auto-run` box, so a sweep can be fired on demand instead of waiting out the interval. The loop could always do this — it is what switching the preference on already triggers — but nothing could ask for it directly, so the only way to fast-forward was to tick the box off and on again. The button is disabled while auto-run is off, because a sweep re-reads the preference and stands straight back down.
