---
'@gemstack/the-framework': patch
---

Retire the session-scoped `TODO_<slug>.agent.md` backlog (#1369) — `TODO_AGENTS.md` superseded it. The [Research] preset (its last writer) now points its `TODO_FILE` at the flat queue, and the session-scoped machinery is deleted: `TODO_FILE_PATTERN` and the scoped branch of the backlog lookup are gone, so `findTodoBacklog` / `appendTodoEntry` read and write only the flat file (`TODO_AGENTS.md`, or a legacy `tickets/TODO.md` / root `TODO.md`). A leftover session file in a checkout is ignored, not drained. The backlog loop itself (`todo-loop.ts`) is untouched — it is the `TODO_AGENTS.md` reader and stays load-bearing.
