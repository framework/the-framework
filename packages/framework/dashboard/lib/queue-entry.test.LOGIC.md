What the tests cover:

- **A queued ticket** - an entry written as a link into `tickets/` reads as the link's title and carries the path its link points at, whole.
- **An agent's note after the link** - the note an agent appended is left out of the title, so the title still fits a one-line list; the full text is still available on the entry.
- **A link out of the project** - an entry pointing at a full web address keeps its title and that address as its destination.
- **A link to any other repository path** - keeps its title and the path; whether a page opens it is not decided here.
- **A plain entry** - an entry with no link is shown as written, and a link in the middle of a sentence counts as part of the sentence rather than as the name of the work.
