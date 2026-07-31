---
'@gemstack/framework-dashboard': patch
---

Picking Haiku in the launcher now shows a warning under the composer (#1439) — never a block: Haiku consistently skips the session-finish protocol (0/5 in the #1334 model-tier test, every stronger tier passed), so a publishing run ends as an unmerged draft PR needing hand-holding. The warning says so before the session is spent and points at Fable for real work.
