What the tests cover:

- **The list is installed** - every built-in package is found in The Framework's own install, and their commands' directories are listed.
- **A project with nothing installed** - its runs are provided by `@openagt/skill-logs` and its checkouts by `@openagt/skill-branches`; kinds no built-in package declares (tickets, git host) have no provider and no problem.
- **A project's own package wins** - a project whose own package declares the runs is read through that package, while a kind it has no package for still comes built in.
- **A built-in git host** - it is a project's git host only when the project's `origin` is on that host: not with no remote, not with a remote on another host.
- **The clean-ups** - in a project with three packages that each declare a clean-up, every one is run in the project with the one word `cleanup`: the one that answers well has its removed path and its kept entry in the answer; the one that refuses is the line "busy: a run is still working here", its last stderr line; the one whose `removed` is not a list is the line "odd: its clean-up answered something else than what it removed and kept"; a failure does not stop the others.
