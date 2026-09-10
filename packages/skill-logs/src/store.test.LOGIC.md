What the tests cover, against a real repository with a bare `origin`:

- **Recording** - a run is written under the directory of the lowercased email the repository commits as, card and diary together, as one commit "logs: record run <id>" that is pushed and leaves the checkout clean (committed, not merely written); a run whose id is unsafe is refused and nothing is written.
- **Listing and reading** - runs list newest first; a start time keeps only the runs started at or after it; a run is found by id, and an unknown or unsafe id finds none; a diary reads back line by line, is empty for a run written with none, and is none for an unknown run; the card and diary paths of a run are answered.
- **Patching** - the branch and the pull request land on the card as one commit "logs: patch run <id>", survive the daemon's next sync because they were committed rather than left dirty, and patching an unknown run reports false.
- **Deleting** - a run's card and diary go as one commit "logs: delete run <id>", the run disappears from the list, and deleting it again is a landed no-op that changes nothing.
- **A run recorded again stays where it sits** - a run another machine filed under its own person, left marked `running`, is ended by this machine in place, under that person's directory, with its diary line added; a card that does not parse is skipped from the listing.
- **No remote** - a repository without one records locally and reports that nothing was pushed; a directory with no checkout lists no runs.
