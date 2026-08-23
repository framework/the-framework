What the tests cover: the page reads one ticket by its filename and shows its full markdown body, not just the head the list row shows; the meta row sits below the description and carries age first, then priority (spelled out as "Priority: 8" rather than a bare number), then the link to the ticket's GitHub item, along with the "planned" mark and the effort and uncertainty a plan recorded.

Queue writes the ticket to the agent queue under its title, carrying its filename and priority; a queued ticket then reads "Queued" and cannot be queued again, while a failed write shows the reason and leaves the ticket queueable.

A claimed ticket shows the claim, names its holder inline, and offers Release lock; releasing lifts the claim immediately rather than waiting for the next read, and a failed release shows the reason and keeps the claim visible. An unclaimed ticket offers no release at all. A ticket that no longer exists says so instead of rendering blank, and Back returns to the tickets list.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
