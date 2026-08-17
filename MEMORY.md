## Decisions

- **The CLI always runs in the foreground.** Ctrl-C closes everything — the dashboard and every session it is running. There is no background/detached daemon mode.
- **The CLI options are minimal.** Every other setting belongs to the dashboard, which is the product's only user interface.
- **Only remove what has been pushed to the git remote.** Worktrees, branches, archives — anything deleted must already exist on the remote, so every removal is recoverable from it.
- **Never interrupt a running session because of low quota.** Quota gates whether a session may *start*; a session already running is never paused, degraded or cut short.
- **The unit of work is an *agent*** — not a run or a session. The CLI that drives it (`claude`, `codex`) is the *driver*.
- **Zero migration code.** Nothing reads a file name, a key spelling or a file shape that was renamed or replaced. The project has no users, so a rename is a break to take, not a compatibility branch to carry; migration is manual — rewrite the file.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/ai-memory/refs/heads/main/memory.md
