---
"@gemstack/framework": minor
---

Add "Open folder" and "Open in editor" buttons to the dashboard project panel (localhost-only). The daemon spawns the OS file manager (open / xdg-open / explorer) or an editor (the `code` CLI, or `$FRAMEWORK_EDITOR`) on the project's own path. A missing command surfaces a friendly error. Safe on a public host: no local checkout to resolve, so nothing is spawned.
