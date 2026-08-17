---
'@gemstack/the-framework': minor
---

The separate "Import tickets from GitHub" preset is gone; "Update from GitHub" is the one GitHub sync. The update prompt already treats an empty `tickets/` as its first import — every open issue comes across — so the import preset was a second button for the same work, and two entry points meant two prompts to keep honest. Every surface that offered the import (the empty backlog panel, the onboarding checklist) now offers the update under its own label, sending the same preset text verbatim wherever it is pressed.
