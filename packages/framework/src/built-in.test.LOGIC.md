What the tests cover:

- **The list is installed** - every built-in package is found in The Framework's own install, and their commands' directories are listed.
- **A project with nothing installed** - its runs are provided by `@gemstack/skill-logs` and its checkouts by `@gemstack/skill-branches`; kinds no built-in package declares (tickets, git host) have no provider and no problem.
- **A project's own package wins** - a project whose own package declares the runs is read through that package, while a kind it has no package for still comes built in.
- **A built-in git host** - it is a project's git host only when the project's `origin` is on that host: not with no remote, not with a remote on another host.
