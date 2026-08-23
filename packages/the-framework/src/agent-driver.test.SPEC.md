What the tests cover: the `actions` run target executes the agent on a GitHub Actions runner and the `web` run target hands it to a Claude Code cloud session; every other case — no run target named, or `local` — runs the agent on this device with the driver the user chose, Claude Code or Codex; the `actions` target is refused with an explanatory error when the repo owner, repo name and GitHub token are missing; the `web` target starts with no configuration at all, because the coding-agent CLI already holds the account the cloud session uses.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
