AI agents store knowledge communicated by humans that they should remember across sessions in `MEMORY.md` files.

## Decisions

- **The CLI always runs in the foreground.** Ctrl-C closes everything — the dashboard and every session it is running. There is no background/detached daemon mode.
- **The CLI keeps exactly four options: `--host`, `--port`, `--help`, `--version`.** Every other setting belongs to the dashboard, which is the product's only user interface.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/ai-memory/refs/heads/main/memory.md
