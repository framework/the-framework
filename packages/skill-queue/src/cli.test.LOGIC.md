What the tests cover, against a real origin holding the `agent-data` branch and checkouts acting as agents on their own branches:

- **The bare command** - answers the open entries off origin as one JSON array, and from another checkout reads every push, the first checkout's included.
- **Add** - an entry with a priority lands in its section as one commit "queue add: <entry>" pushed to origin, a new section placed between the higher and the lower ones and an unranked entry appended at the end of the file in the section that ends it; the commit is authored as the checkout's git user; the caller's checkout keeps no copy of the branch and stays clean; the answer echoes the entry and its priority when given.
- **Done** - deletes the entry's line, never checks it off, as "queue done: <entry>"; an entry the queue does not have refuses `no-entry` with `no open queue entry reads "<entry>"` and exit 1.
- **A branch with no queue** - reads as an empty array, and the first add creates the file with the entry in its section.
- **Usage errors** - an unknown command prints the usage with nothing on stdout; an argument to the bare command, a missing text, a blank text, a priority of 11 or a non-numeric one, and a missing or extra argument to `done` all exit 2, and none of them writes anything.
- **No remote, no repository** - a repository with no remote reads its local branch and refuses to write with `no-remote`; outside a repository a command refuses `not-a-repo` and exits 1.
