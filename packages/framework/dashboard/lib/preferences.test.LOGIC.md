What the tests cover:

- **A change is in force before the daemon answers** - a toggle made while the first load is still running stays as the user set it when that load arrives carrying the older value; when nothing raced it, the loaded values are what the dashboard shows.
- **The repository's file wins where it speaks** - with a project open, its committed `the-framework.yml` overrides the user's own answer for the keys it sets and adds the ones the user never set, while every other setting stays the user's; a project with no such file changes nothing.
- **One writable tier** - a toggle on a project's page writes to the user's own preferences only, and the repository's file still wins over what was just written.
- **Where each value came from** - a key set by the repository's file is attributed to the repository, and a key set only by the user is attributed to the user.
- **Re-reading the repository tier** - after the file is edited, the next read shows the new answer, and a file deleted outright stops contributing instead of lingering.
- **A tier that cannot be read** - a failed read of the projects leaves the user's own settings intact, raises nothing, and does not stop the next read from succeeding.
- **A write sends only what changed** - the change carries just the keys the user touched, never the rest of what this tab happens to hold, so a tab open since before someone else's change cannot write the old values back.
- **A write adopts what the daemon stores** - the merged answer replaces this tab's values, so a tab that was stale about another tab's change converges on it.
- **Out-of-order answers** - the answer to an older write is ignored once a newer write has gone out, so the value the user last chose stands.
- **A refused write** - a daemon that cannot store preferences at all leaves the chosen value in force on screen.
- **Re-reading the user's own tier** - a re-read replaces the values with what the daemon now stores, except while one of this tab's writes is still in flight, when it is skipped so it cannot undo the write.
- **The theme** - an unset theme reads as "system"; a fixed choice ignores the operating system, and "system" follows the operating system's dark preference.
