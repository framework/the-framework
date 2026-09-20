What the tests cover:

- **The whole ticket** - the page reads the ticket by its file name, heads the page with its title and renders its entire content, including what sits well below the summary.
- **What is known about it** - "Priority: 8" spells out what the number rates rather than showing a bare "8"; "planned" marks a ticket that has a plan; "Effort: 2" and "Uncertainty: 0" show what the plan recorded.
- **Where the facts sit** - all of them sit below the summary, never beside it, in the order age, priority, then the GitHub issue link, which points at the issue's own address.
- **The ticket as a link** - "Add to queue", the action a mounted widget offers on links in this project, receives the ticket as one link: its title, pointing at `tickets/<file>`, its priority as a number on the 0–10 scale; a ticket with no priority is handed over at 5.
- **Queued once** - after a successful action the button reads "Queued" and is disabled, so the same reading cannot queue it twice.
- **A refused action** - shows its reason and leaves the button ready to try again.
- **No widget, no button** - when no mounted action covers the ticket's project, the page shows no queue button.
- **A missing ticket** - reads "This ticket does not exist." rather than rendering blank.
- **A claimed ticket** - shows the "claimed" badge with the holder named inline, so the user knows whose claim they are about to lift, and offers "Release lock"; an unclaimed ticket shows neither.
- **Releasing** - lifts that ticket's claim and takes the badge and the button away at once, without waiting for the next read.
- **A refused release** - shows the daemon's reason and leaves the claim standing.
- **Back** - returns to the tickets list.
