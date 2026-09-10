What the tests cover:

- **The list** - the card's description reads "Agents currently working", each working agent's row shows its label, and there is no "Current" or "Recent" split.
- **Opening an agent** - clicking a row opens that agent itself, project and agent both, never only the project's launcher.
- **Empty and loading** - with nothing working the card says "No agents working right now."; while the first read is still out it says "Loading…" instead, so loading is never mistaken for empty.
- **A label for every row** - an agent with a blank intent is labeled by its session name rather than left as a blank line.
- **Another machine's agent** - an agent started by another machine's daemon carries "from <host>", and an agent of this daemon's own carries no such tag.
