The dashboard's address scheme — the URL is the selection: the Overview at the root, then a project, then one of its sessions.

## TLDR

- Reserved words carve out the non-project views: settings, the cross-project tickets list, a project's tickets, one ticket's own page, and its plan view beneath that.
- Reserving them is safe because a real id can never be those bare words: project ids always carry a hash suffix and run ids are derived from their start time.
- The session segment is the run's own stable id, not the agent's conversation id, and "session" is the user-facing word for a run.
- Anything unparseable is the Overview and stray extra segments are ignored, so a hand-typed URL cannot break the view.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
