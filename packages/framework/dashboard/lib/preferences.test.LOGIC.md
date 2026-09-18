What the tests cover:

- **A change is in force before the daemon answers** - a toggle made while the first load is still running stays as the user set it when that load arrives carrying the older value; when nothing raced it, the loaded values are what the dashboard shows.
- **A write sends only what changed** - the change carries just the keys the user touched, never the rest of what this tab happens to hold, so a tab open since before someone else's change cannot write the old values back.
- **A write adopts what the daemon stores** - the merged answer replaces this tab's values, so a tab that was stale about another tab's change converges on it.
- **Out-of-order answers** - the answer to an older write is ignored once a newer write has gone out, so the value the user last chose stands.
- **A refused write** - a daemon that cannot store preferences at all leaves the chosen value in force on screen.
- **Re-reading the preferences** - a re-read replaces the values with what the daemon now stores, except while one of this tab's writes is still in flight, when it is skipped so it cannot undo the write.
- **The theme** - an unset theme reads as "system"; a fixed choice ignores the operating system, and "system" follows the operating system's dark preference.
