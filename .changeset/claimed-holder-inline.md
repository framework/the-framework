---
'@gemstack/framework-dashboard': patch
---

The claimed badge (#1420) now names the lock's holder inline — `claimed · <agent-id>` — instead of hiding it behind the native `title` tooltip, which needs a 1-2s still hover nobody discovers. The tickets list truncates a long id to keep the dense rows aligned (full id stays in the tooltip); the detail page shows it in full.
