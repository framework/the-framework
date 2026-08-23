One ticket's own page: its whole markdown body, everything known about it, and the two things a user can do to it — put it on the agent queue, or lift another agent's claim.

## User story

The tickets list shows one line per ticket; a user who wants to actually read a ticket, decide whether to work it now, or unstick one that a dead agent still holds, opens it here.

## Business logic — TL;DR

- **The whole ticket, by identity** - the page is read directly by the ticket's filename inside `tickets/`, and re-read every ten seconds so a ticket changed by an agent or by Auto PM stays current.
- **Queue** - puts the ticket on the agent queue and then reads as "Queued", so the same ticket is not queued twice from this page.
- **Release lock** - offered only while the ticket is claimed, and lifts the claim by hand.
- **Everything known about the ticket, in one row** - age, priority, the linked GitHub item, topics, whether it is planned, who claims it, effort, uncertainty, and the ticket's filename.

## Business logic

### The whole ticket, by identity

#### User story

See `## User story`.

#### Business logic

The page shows the ticket's title, its summary, and its complete markdown body rendered for reading — not the first lines the list row shows. It is fetched by the ticket's filename, the same identity the list row and the page's own address carry, and re-fetched every ten seconds. Until the first read lands the page says it is loading; if the ticket no longer exists — deleted between the list read and this one, or a link typed by hand — the page says so plainly instead of showing an empty ticket. A Tickets button returns to the list.

Below the summary sits a single row carrying everything else known about the ticket, in this order: how long ago it was written (with the exact date and time on hover), its priority, the GitHub issue or pull request it stands for, its topics, a "planned" mark, its claim, its effort and uncertainty estimates, and last its filename.

### Queue

#### User story

The user reads a ticket, decides it is worth doing, and wants it worked without composing a prompt.

#### Business logic

Queue adds the ticket to the agent queue under its own title, carrying its filename and its priority. Once accepted the button reads "Queued" and is no longer pressable, so the page cannot enqueue the same ticket twice. A failure leaves the button as it was and shows "The ticket could not be queued." on the page.

### Release lock

#### User story

An agent claimed a ticket and then died. Nothing frees the claim on its own, so the ticket would sit unavailable forever.

#### Business logic

A claimed ticket shows a "claimed" mark naming its holder, and offers Release lock. Pressing it removes the claim; the page then immediately reads as unclaimed rather than waiting for the next ten-second read to confirm it. A failure shows "The lock could not be released." Unclaimed tickets offer neither the mark nor the button.

#### Rationale

Claims are not timed out: a stale claim is deliberately left standing until a human decides the holder is gone, since silently freeing a ticket a live agent still works would let two agents work the same ticket.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
