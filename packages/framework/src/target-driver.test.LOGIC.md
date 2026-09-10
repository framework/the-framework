What the tests cover:

- **The location picks the driver** - `actions` with its configuration yields the GitHub Actions driver; `local` and no location at all yield the driver for the chosen coding agent, Claude Code for `claude` and Codex for `codex`; `web` yields the cloud driver.
- **`actions` requires its configuration** - without the repository owner and name, the token and the workflow, the agent is refused and told what it needs.
- **`web` requires no configuration** - the cloud driver is built with nothing of The Framework's, since the coding agent's CLI holds the account.
