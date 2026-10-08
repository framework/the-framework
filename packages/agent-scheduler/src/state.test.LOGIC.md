What the tests cover, against a real git repository:

- **The defaults** - no state file reads as off, no keep-alive, `opus`, a spend cushion of 100/14 points.
- **Writing and reading** - the first write adds `/.agent-scheduler` to the repository's exclude file and `git status` shows nothing; a hand-written partial file reads back with the defaults filled in; an edit writes and answers the changed state.
- **A corrupt file** - a state file that does not parse reads as the defaults rather than stopping the tick.
- **A schedule switch per machine** - with nobody switching, a command is off; a command switched on is kept as `true` and is on, while another command stays off; switching off a command nobody switched on keeps nothing of it; switching every command off again leaves no `switches` in the state; an entry written by hand that is not `true` (`"on"`) is off.
- **A publish pick per machine** - with nobody picking, a command's pick is `commit` and its runs are given `commit`; a pick of `nothing` gives its runs no level, a pick of `pr` gives them `pr`, and another command stays at `commit`; a pick of `commit` is kept like any other; a word that is no pick (`push`) in the state reads as nobody having picked: `commit`.
- **A scheduler ending** - clears the pid and the start time only when the pid is its own; a pid another scheduler wrote meanwhile stays, and a state with no pid is unchanged.
