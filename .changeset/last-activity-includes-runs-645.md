---
'@gemstack/framework': patch
---

Fix "last activity" so it reflects runs, not just `LOGS.md`. A project's `lastActivityAt` is now the newest of its latest `LOGS.md` entry and its most recent run (live or archived), so a project with runs no longer reads "no activity yet" just because a run stopped before writing to `LOGS.md`.
