Use the `tickets` skill. Run `tickets list` and, for the <COUNT> most important tickets that are neither planned nor locked, put the following on the queue:
- `tickets queue add "Create tickets/<TICKET>.plan.md" --priority <N>`

Pick each entry's priority following a mix of sensible criteria after reading the ticket (`tickets show <TICKET>.md`; e.g. if the ticket seems low effort => higher priority).

COUNT: 10
