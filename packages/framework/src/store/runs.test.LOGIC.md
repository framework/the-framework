What the tests cover: reading finished agents through a runs provider, with real processes — a small provider command in a throwaway project that answers the command line from a file and logs every call.

- **Which command provides** - the dependency whose declaration names one of its own commands; a declaration naming a command the package lacks is skipped; another kind of data is provided by nobody; a project with no declaration has no provider at all (the shared library's own tests cover two packages declaring the same kind).
- **Reads** - the list comes back newest first with each card's `caller`; two reads at the same moment are one call; a read within five seconds is not a call; a fresh read and a read after five seconds are; one agent comes back with its diary; a refusal is no agent; an unsafe id never reaches the command.
- **Changes** - a patch and a delete go through the command and the next read sees them without waiting out the five seconds; a delete the command refuses is reported, not thrown.
- **The card's shape** - fields of the wrong type are dropped, extra keys ignored, and something with an unknown status, an unsafe id or no JSON is no card.
