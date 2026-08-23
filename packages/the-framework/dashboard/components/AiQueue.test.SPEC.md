What the tests cover: the Overview's AI Queue card.

- A queued ticket reads as its title, keeps the whole raw queue line as its hover hint, and opens that ticket's own page inside the dashboard.
- An entry linking outside the dashboard is a real link opening in a new tab; an entry naming nothing stays plain text with nothing pretending to be clickable.
- The play button starts one unattended agent on exactly the clicked entry — the prompt carries that entry's raw line, not its tidied title, and not the first entry's — and the dashboard then goes to the agent it started.
- The play button says what it does on hover.
- A start that comes back without an agent id still hands over the project, so the dashboard can adopt the agent once the poll surfaces it.
- A failed start navigates nowhere and shows the refusal instead of swallowing it.
- While a start is in flight, every play button is disabled.
- Checked-off entries, and projects with nothing open, are not listed.
- Loading and empty read as themselves rather than as each other.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
