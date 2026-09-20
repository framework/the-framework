A ticket as a link [1], said once for both tickets pages: the ticket itself, and the ask for its plan.

## Glossary

[1] link: the name of some work and where it points, as a dashboard page shows it: a text, an optional target and an optional priority from 0 to 10.
[2] plan ask: the sentence `Create tickets/<stem>.plan.md`, the one wording the dashboard uses wherever it asks for a ticket's plan (defined in `src/tickets.ts`).

## Business logic

The ticket as a link is its title, pointing at `tickets/<file>`, at the priority its own `Priority:` earns on the 0–10 scale: the number as written when it is a whole number from 0 to 10, else 5 (the tickets package's rule, `queuePriorityForTicket`). Whatever acts on this link names the ticket, so what is written links back to it.

The plan ask [2] as a link is that sentence, at the same priority, with no target on purpose: a link at the start of a queue entry pointing at a ticket reads everywhere as "this ticket is queued for implementation", and a plan ask must not read as that.
