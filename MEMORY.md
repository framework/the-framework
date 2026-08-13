AI agents store knowledge communicated by humans that they should remember across sessions in `MEMORY.md` files.

## Decisions

- **The CLI always runs in the foreground.** Ctrl-C closes everything — the dashboard and every session it is running. There is no background/detached daemon mode.
- **The CLI keeps exactly four options: `--host`, `--port`, `--help`, `--version`.** Every other setting belongs to the dashboard, which is the product's only user interface.
- **Only remove what has been pushed to the git remote.** Worktrees, branches, archives — anything deleted must already exist on the remote, so every removal is recoverable from it.
- **Never interrupt a running session because of low quota.** Quota gates whether a session may *start*; a session already running is never paused, degraded or cut short.
- **Running agents remotely is core to the product, not a distribution channel.** Claude Code Web, another device, and GitHub Actions runners are how work happens when the laptop is closed.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/ai-memory/refs/heads/main/memory.md
