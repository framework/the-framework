What the tests cover:

- **A queued ticket** - an entry written as a link into `tickets/` reads as the link's title and names its ticket by bare filename, which is what opens the ticket's own page.
- **An agent's note after the link** - the note an agent appended is left out of the title, so the title still fits a one-line list; the full text is still available on the entry.
- **A link out of the project** - an entry pointing at a full web address keeps its title and that address as its destination.
- **A link to anything else** - a target with no page in the dashboard, such as a bare path in the repository, keeps its title and offers no destination.
- **A plain entry** - an entry with no link is shown as written, and a link in the middle of a sentence counts as part of the sentence rather than as the name of the work.
