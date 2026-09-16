What the tests cover, against a real git repository:

- **The defaults** - no state file reads as off, no keep-alive, `opus`, a spend cushion of 100/14 points.
- **Writing and reading** - the first write adds `/.agent-scheduler` to the repository's exclude file and `git status` shows nothing; a hand-written partial file reads back with the defaults filled in; an edit writes and answers the changed state.
- **A corrupt file** - a state file that does not parse reads as the defaults rather than stopping the tick.
