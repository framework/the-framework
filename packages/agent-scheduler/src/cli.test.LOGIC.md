What the tests cover, on the file-only commands against a real repository (the commands that spawn or talk to Claude are covered by their modules):

- **`status`, `model`, `offset`, `stop`** - `status` answers the default state with `running: false`; `model` and `offset` write the state and answer it; `stop` answers the state off; every answer is one JSON object with `ok`; from a subdirectory the same command still acts on the project.
- **Usage errors and refusals** - no command, an unknown command, a missing argument, an offset that is not a number and an extra argument each exit 2 with the usage on stderr and nothing on stdout; outside a repository `status` exits 1 with `{"ok":false,"reason":"not-a-repo"}` and `not inside a git repository`.
- **`tick` with the scheduler off** - the branch is pulled, nothing is decided, the answer's note is `off` and the state remembers the tick.
