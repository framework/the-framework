---
'@gemstack/the-framework': patch
---

Queue claims now see other machines (#1313): an entry is also claimed when any open PR's TODO_AGENTS.md diff retires it (checked off or removed), so two daemons or a cloud session draining the same queue no longer double-assign an entry whose work is already in an open PR
