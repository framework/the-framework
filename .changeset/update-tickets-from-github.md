---
"@gemstack/the-framework": minor
---

Add "Update from GitHub" to the tickets view, for the second and every later import. It resumes from the `lastImportedAt` stamp in `tickets/meta.json` and reconciles rather than refilling: an existing ticket is edited in place, the `.spike.md` and `.plan.md` written against it are kept, and a closed issue's ticket goes. The importer writes the stamp too, so the first update has somewhere to resume from, and the view says when `tickets/` last caught up.
