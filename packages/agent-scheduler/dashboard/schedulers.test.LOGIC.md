What the tests cover:

- **A row from what status printed** - for a scheduler that ticked with two lines, each scheduled command carries this machine's schedule switch and publish pick over what its line says: a command whose line says `publish merge` with a pick of nothing keeps both, and a command whose line says off but which this machine switched on reads as on; the row carries the scheduler's on, keep-alive, running, model and spend cushion, and the last tick's time and decisions. A scheduler that never ticked lists no command. A field that is not what the command promises reads as absent: an `on` that is a word, a cushion that is a word, a model that is a number, a pick and a level that are no known word, a decision without an outcome, a schedule line without its on/off; output that is no object gives no commands.
- **Reading through the command** - `status` runs once in every project; a project whose command fails is a row that says why, holds nothing else, and leads with "not readable".
- **The cushion in force** - the loosest of the rows' cushions; none when no row holds one or there is no row.
- **A typed cushion** - a fraction is rounded, a number out of range is held to −50 or 50, zero is zero; a minus sign alone, a blank and an empty text are no number.
- **Saving the cushion** - `offset -- <points>` runs in every project, a negative fraction after the `--`; with one project failing the answer names it and why.
- **A row's leading status** - "on" in green, "on, not running" when the process is gone, "off" when the scheduler is off.
- **The pace in words** - an interval alone is "every 1d", a check alone "when its check finds work", both "every 6h at most, when its check finds work".
- **How far a command publishes, in words** - no level is "publishes nothing", `branch` "publishes its branch", `pr` "opens a pull request", `merge` "opens a pull request that merges on green"; this machine's pick stands in for the line's level in both directions.
- **The publish menu's picks** - all four with a git host package, "Nothing" and "Publish branch" without; a saved pull request pick the project is no longer offered is still listed.
