What the tests cover: every command of the command line against real git, from clones acting as agents that share one origin, and the contract around them.

- **Reads** - `list` gives every open ticket with its priority, whether it is planned and its plan's effort; `show` gives one ticket's whole text, its plan and its holder, and takes the ticket by its bare filename or by its path; `queue` gives the open entries in order of work; all of it read off origin, from a clone holding no checkout of the branch.
- **A missing ticket** - refused as no such ticket, on stdout and in one line on stderr; a name that escapes the folder is refused as an invalid path.
- **Claiming** - the lock is written as one pushed commit naming the holder, authored by the agent's own clone; a second claimer from another clone is refused and told who holds it, with exactly one lock commit on the remote; the holder shows up on the reads; claiming again yourself succeeds, because the lock is already yours; a ticket that does not exist cannot be claimed.
- **Nothing lands locally** - the agent's clone gains no copy of the branch and no change in its own working tree.
- **Releasing** - only the holder may release: someone else's claim is refused and names its holder; the holder's own release deletes the lock on the remote; releasing again reports no claim; the ticket is then free for the other agent to claim.
- **Who the holder is** - `AGENT_ID` from the environment when the process that started the agent set it, and that id survives the session renaming its branch; without it the current branch, even inside a `.branches/agent-<id>` checkout; a detached checkout with no `AGENT_ID` is refused as having no identity.
- **`put`** - a ticket, a plan (named by its `tickets/…` path) and `meta.json` are written from standard input, each as one commit named after the file; a `.lock.md`, a path that climbs out, a nested path and a non-markdown name are all refused as an invalid path; the ticket just written lists, planned, with its plan's effort.
- **`close`** - the ticket goes with its plan and its claim, leaving the other tickets untouched; closing it again reports no such ticket; a ticket someone else holds (claimed from another clone) is refused as not the holder's, naming the holder.
- **`queue add`** - an entry lands in the section its priority names; with a ticket named it becomes a link back to that ticket, placed by the ticket's own priority; with no priority it goes at the end; the file that results is the sections in order, high to low; a priority outside the scale is a usage error, and a ticket that does not exist is a refusal.
- **`queue done`** - the line is deleted rather than checked off; an entry that is not open is refused as no such entry.
- **A repository with no remote** - reads come off its local copy of the branch, and every write is refused because nothing can carry it.
- **Outside a repository** - refused as such.
- **Usage** - an unknown command and a wrong argument count get the usage on stderr, no JSON, and exit code 2.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
