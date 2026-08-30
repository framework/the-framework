Use the `tickets` skill. Look at all tickets (`tickets list`; `effort` and `uncertainty` are in its output) and choose tickets to work on next:
- Pick a ticket if it has a plan that shows it's a quick-win (low `effort` value) with `uncertainty: 0`
- Put each picked ticket on the queue: `tickets queue add "<title>" --ticket <file> --priority <N>`
  - With sensible prioritization, and consider bumping the priority of lowest effort tickets (e.g. to make `effort: 0` the next tasks agents work on)

Always set <SESSION_NAME> to triage-quick
