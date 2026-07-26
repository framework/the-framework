---
'@gemstack/framework-dashboard': patch
---

Reworked the usage bar per #960: each day of the quota week is now shown exactly once (centred in an equal seventh of the bar, delimited from its neighbours), instead of walking local midnights and repeating the start day at both ends. The bar itself now splits left-to-right into what's been used (solid) and the room left before unattended work stops (dimmed) — dragging that dimmed segment's own edge sets the limit, replacing the separate full-width slider that used to sit underneath the bar. A legend explains the two shades and the daily-boundary line.
