---
'@gemstack/the-framework': patch
---

The per-run quota guard now honors the Usage panel's spend slider when it loosens the gate (fix #1490): the line a run pauses at is `max(default half-day cushion, autoSpendOffset)`, read fresh around each between-turns check so dragging the slider unblocks a parked run without a restart. Before, the guard hard-coded the default cushion and a run paused on a window the Usage bar showed as having room — the exact bar/gate disagreement #960 forbids. The slider still never tightens the gate on work the user asked for.
