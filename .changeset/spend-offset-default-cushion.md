---
'@gemstack/the-framework': patch
---

Unattended work's default stop line (#960) is now a half-day cushion ahead of the quota boundary, rather than sitting exactly on it. Landing precisely on the boundary looked generous on paper, but it meant any account tracking its own week's pace almost exactly — completely normal — got stopped by ordinary jitter around the line rather than by actually overspending. A fresh install, or any account that has never touched the slider, now gets that room by default; dragging the slider still overrides it same as before.
