What the tests cover: a read for a project that is not registered has no checkout to answer from and says so with that read's empty result — an empty file list, an empty per-file status map, no worktree, no plan author — rather than failing. An agent id that could escape the worktrees directory is refused, since the id names a directory.

Also: a `web`-target agent whose session the browser bridge holds a question for is handed to the dashboard marked as waiting; one with no such question, or a local agent, is handed over untouched. An agent whose recorded host is another machine is handed over marked as from another host; one this machine started, or one with no recorded host, is not.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
