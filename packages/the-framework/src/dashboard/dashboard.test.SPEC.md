What the tests cover: the Overview page's payload.

- The rollup carries the number of registered projects, the number of agent queue entries still open across all of them, the agents working right now, and each project's own agent queue.
- Projects come back most recently active first, because the onboarding checklist acts on the first one — the ordering is an output even though the activity timestamps are not reported.
- Each project reports whether it has any tickets, which is what the onboarding checklist reads.
- The payload carries nothing beyond those fields: the shape is pinned so that adding a field back — in particular one that would cost a read of every project's whole agent archive on every poll — is a deliberate decision rather than an accident.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
