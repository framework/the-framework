---
"@gemstack/framework": minor
---

Serve the new Vike + Telefunc dashboard for per-run foreground runs and `--resume`, not just the daemon. `framework "<prompt>"` and `framework --resume` now serve the rebuilt dashboard in single-project mode, scoped to that run's workspace without touching the global registry, and the live run steers over its own `.the-framework/control.jsonl` even with no daemon running. Falls back to the legacy `page.ts` when the bundle is absent or `--no-persist` is set. Adds `singleProjectProvider` and `resolveDashboardBundle` to the public surface.
