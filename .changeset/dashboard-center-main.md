---
'@gemstack/framework': patch
---

Center the dashboard's main grid in the content column. `main` had a `max-width: 1100px` cap but no horizontal centering, so on a wide window the panels hugged the left edge next to the runs sidebar. Add `margin: 0 auto` so the capped grid sits centered.
