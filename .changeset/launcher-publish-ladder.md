---
'@gemstack/the-framework': patch
'@gemstack/framework-dashboard': patch
---

The launcher now shows the whole publish ladder (#1379): **Push branch** → **Open PR** → **Auto-merge**, each enabled only while the rung below it is on. Previously only Open PR and Auto-merge were offered, so unticking Open PR silently meant "push-only" — the launcher read as "publishing off" while the session still pushed the branch. Unticking Push branch now publishes nothing, and `handoffFromPreferences` treats `autoPushBranch` as the master rather than letting an armed PR force the push back on. Defaults are unchanged: push and PR on, auto-merge off.
