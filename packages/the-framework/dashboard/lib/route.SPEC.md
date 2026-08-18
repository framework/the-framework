The dashboard's address scheme — the URL is the selection: the Overview at the root, then a project, then one of its agents.

## TLDR

- Reserved words carve out the non-project views: settings, the cross-project tickets list, a project's tickets, one ticket's own page, and its plan view beneath that.
- Reserving them is safe because a real id can never be those bare words: project ids always carry a hash suffix and agent ids are derived from their start time.
- The third segment is the agent's own stable id, not its conversation id with the driver: only the agent id is ours, stable, and already the name of its worktree directory.
- Anything unparseable is the Overview and stray extra segments are ignored, so a hand-typed URL cannot break the view.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
