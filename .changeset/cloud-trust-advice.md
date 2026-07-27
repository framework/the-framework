---
'@gemstack/the-framework': patch
---

claude-web runs that die on the Claude Code folder-trust dialog now fail with the one-time fix (trust the project root once; run worktrees inherit it) instead of the raw dialog text, and the notice no longer points at the ephemeral worktree path (#1314)
