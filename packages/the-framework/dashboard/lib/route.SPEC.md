The dashboard's address scheme — the URL is the selection: the Overview at the root, then a project, then one of its agents.

## TLDR

- Reserved words carve out the non-project views: settings, the cross-project tickets list, a project's tickets, one ticket's own page, and its plan view beneath that.
- Reserving them is safe because a real id can never be those bare words: project ids always carry a hash suffix and run ids are derived from their start time.
- The third segment is the agent's own stable id, not its conversation id with the driver; the URL spells that segment "session" because that is still the user-facing word, so the address reads the way the buttons do while the record it names is the agent's.
- Anything unparseable is the Overview and stray extra segments are ignored, so a hand-typed URL cannot break the view.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
