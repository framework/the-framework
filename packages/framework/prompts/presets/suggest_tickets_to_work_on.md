1. Look at all tickets (`tickets list`, from the `tickets` skill) and pick tickets to work on next
2. Show the tickets you picked via `showMultiSelect()`
  - For each ticket, if high confidence the ticket is a good candidate to work on next => set its default to `true`, otherwise `false`
3. <AWAIT>
4. Put each approved ticket on the queue: `queue add "[<title>](tickets/<file>)" --priority <N>` (from the `queue` skill; <N> the ticket's `Priority:`, 5 when it has none)

AWAIT: Stop, await user answer before resuming
