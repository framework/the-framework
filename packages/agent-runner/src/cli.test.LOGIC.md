What the tests cover, the command line's own refusals against a real repository (the commands that spawn or talk to a coding agent are covered by their modules):

- **Usage errors** - no command, an unknown command (the scheduler's `tick` and `status` among them), and an extra argument to `check` or `init` each exit 2 with the usage on stderr and nothing on stdout; so do a `run` or a `check` on a driver `agent-runner` does not know (`unknown driver "pi"; the drivers are claude-code and codex`), a `run --resume` given a `--driver`, a `run --detach --resume` given an `--id` or a `--then`, and a `run` given a `--command`, since a run names no command.
- **Outside a repository** - `check` exits 1 with `{"ok":false,"reason":"not-a-repo"}` and `not inside a git repository`.
