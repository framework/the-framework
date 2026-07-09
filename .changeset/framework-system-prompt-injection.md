---
'@gemstack/framework': minor
---

feat(framework): inject a system prompt into every prompt (anti-lazy-pill + SYSTEM.md)

Every run is now framed with a built-in system prompt: the validated anti-lazy-pill (#297), which turns unclear scope into a ranked list, a large scope into a `PLAN.md`, and a very large one into a `TODO.md` backlog, so the agent builds a real backend and declares what it descopes instead of silently faking it. Drop a `SYSTEM.md` at the workspace root to add project-specific instructions on top, or set `antiLazyPill: false` in `the-framework.yml` to remove the built-in default. Closes #301.
