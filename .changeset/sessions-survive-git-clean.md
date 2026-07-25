---
'@gemstack/the-framework': patch
---

Session history is now committed, so it survives the repo being cleaned. A project's finished runs used to be archived to a gitignored `.the-framework/runs/`, which meant `git clean -fdx` silently deleted every session a project had ever run. They are now archived to `.the-framework/<your git email>/sessions/` and committed alongside the conversations. Sessions archived before this are still listed, and every user's sessions show in the project's history.
