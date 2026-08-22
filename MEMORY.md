## Decisions

- **The CLI always runs in the foreground.** Ctrl-C closes everything — the dashboard and every session it is running. There is no background/detached daemon mode.
- **The CLI options are minimal.** Every other setting belongs to the dashboard, which is the product's only user interface.
- **Only remove what has been pushed to the git remote.** Worktrees, branches, archives — anything the framework removes on its own initiative must already exist on the remote, so every removal is recoverable from it. A delete the user asked for and confirmed is the exception: throwing the work away is what it is for.
- **Never interrupt a running session because of low quota.** Quota gates whether a session may *start*; a session already running is never paused, degraded or cut short.
- **The unit of work is an *agent*** — not a run or a session. The CLI that drives it (`claude`, `codex`) is the *driver*.
- **Zero migration code.** Manual migration is good; code that migrates is not. A renamed or deleted thing leaves nothing behind — no fallback to the old name, no key alias, no old-format branch, no upgrade step. Nor a notice about what was dropped: a warning about data nobody has is still code nobody needs.
- **Haiku is out of scope.** It skips the session-finish protocol, so unattended work started on it always ends as an unmerged draft PR that a human has to finish. We deliberately don't work around this: no model floor that overrides the model a user picked, and no refusal to arm the hand-off. The dashboard's warning is the whole treatment — it teaches and never blocks.
- **The version line stays in `0.x`.** The releases are experimental, and while the major is `0` a minor bump is allowed to break — so no experiment ever costs a major.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/ai-memory/refs/heads/main/memory.md
