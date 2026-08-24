What the tests cover: the Overview's AI Queue card.

- A queued ticket reads as its title, keeps the whole raw queue line as its hover hint, and opens that ticket's own page inside the dashboard.
- An entry linking outside the dashboard is a real link opening in a new tab; an entry naming nothing stays plain text with nothing pretending to be clickable.
- The play button starts one unattended agent on exactly the clicked entry — the prompt carries that entry's raw line, not its tidied title, and not the first entry's — and the dashboard then goes to the agent it started.
- The play button says what it does on hover.
- A start that comes back without an agent id still hands over the project, so the dashboard can adopt the agent once the poll surfaces it.
- A failed start navigates nowhere and shows the refusal instead of swallowing it.
- While a start is in flight, every start button — the play buttons and the fan-out button — is disabled.
- The fan-out button starts one unattended agent per top open entry — three by default, each prompt pinned to its own raw queue line, in queue order, skipping checked-off entries — and navigates nowhere.
- The count beside the fan-out button sets how many agents the click starts.
- The fan-out button promises only what is open: with fewer open entries than the count, its label and the batch shrink to the open entries, and a single open entry reads singular.
- A refused start ends the fan-out batch: the remaining entries are not started.
- While a fan-out batch is in flight — including between two of its starts — every start button is disabled, until the batch ends.
- Checked-off entries, and projects with nothing open, are not listed.
- Loading and empty read as themselves rather than as each other.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
