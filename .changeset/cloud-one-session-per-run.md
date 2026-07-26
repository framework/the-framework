---
'@gemstack/the-framework': patch
---

A "Run on: Claude web" run now hands off to exactly one cloud session. A run is not a single prompt — the loop prompts again for each pass — and the driver was starting a fresh cloud session every time, so one run opened six of them, all racing on the same repo. The first prompt hands off; every later pass reports that hand-off instead of spending another session.
