What the tests cover: every command of the command line against real git, from clones acting as agents that share one origin, and the contract around them.

- **The bare command** - every person's runs off origin, newest first, the package's fields only (no `caller`), from a clone holding no checkout of the branch; `--ticket` by the ticket's file name or its path, `--branch`, `--limit`, and the cap counting the runs kept; the default cap; nothing lands in the agent's clone.
- **`show`** - the card with the agent's four kinds of diary line and none of the writer's; a run with no diary file has no lines; an id no run has is refused as no such run, on stdout and in one line on stderr.
- **Usage** - an unknown command, an unknown option, a limit that is not a whole number above 0, an argument missing or extra and an id that is not one all get the usage on stderr, no JSON, and exit code 2.
- **A repository with no remote** - reads come off its local copy of the branch.
- **Outside a repository** - refused as such.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
