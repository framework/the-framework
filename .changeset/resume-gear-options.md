---
'@gemstack/the-framework': patch
'@gemstack/framework-dashboard': patch
---

The session composer's gear now follows what the next action arms (#1172): while a run is live it is dropped entirely (it used to open an empty dropdown), and once the run has ended it returns as "Resume options" — Autopilot, the publish ladder (Push branch / Open PR / Auto-merge) and Browser, the options a Resume continuation actually resolves at start (#1469). Prompt-shaping rows and Run on / agent / model stay launcher-only.
