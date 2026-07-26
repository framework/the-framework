---
"@gemstack/the-framework": patch
---

Fix the session view crashing (Base UI error #31) on multi-app repos once the preview URL clears, e.g. right after Stop session: the session menu's "Serve which app" submenu label was missing its menu-group wrapper.
