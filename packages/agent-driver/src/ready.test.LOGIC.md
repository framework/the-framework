What the tests cover, with the CLI's answers handed in and never a real CLI:

- **Ready** - an installed, logged-in Claude Code and a logged-in Codex have no problem and no warning.
- **Not installed** - a missing CLI is one problem naming its binary and its install page, and its login is not asked; Codex is asked about `codex`, not `claude`, and points at the Codex install.
- **Logged out** - a logged-out Claude Code is one problem naming `claude auth login`; Codex's "Not logged in" is read as no (not as the "logged in" it contains), also when it comes on standard error, and names `codex login`.
- **Could not say** - a CLI whose login answer cannot be read (an older CLI's "unknown command") is ready.
- **Root** - root is one warning naming the `sudo` user, and no problem.
