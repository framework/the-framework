Renders a file's diff (git unified output, #816) or an unchanged file's contents (#828), shared by the tree's hover card and the run view's Changes section (#817).

## TLDR

- `DiffView`: colors patch lines by prefix (`+++/---` muted, `@@` primary, `+` success-tinted, `-` danger-tinted); `DiffStat` is the shared `+12 −3` pair; `ContentView` shows plain files with line numbers (they make a body scannable and are how you say "line 40" to the session in the composer).
- Shared `Cut` ("Cut here. The rest is in the worktree.") and `Binary` fragments so truncated/binary render identically everywhere.

## Decisions

- Deliberately plain — no syntax highlighting, no editing: the dashboard is not an editor (the risk raised on #475); this answers "what did the session do" and "what is in this file", nothing more.
- Diff tints use color tokens at /10 opacity rather than fixed palette steps: the 300s wash out on light backgrounds, the 700s on dark ones.
