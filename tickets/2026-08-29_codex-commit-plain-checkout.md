Priority: 5
Topics: [bug, agent-driver, codex]
GitHub: [#1747](https://github.com/framework/the-framework/issues/1747)

# Codex cannot commit in a plain checkout: the default sandbox refuses writes under .git/

## TLDR

The Codex driver runs `codex exec --sandbox workspace-write` (`packages/agent-driver/src/codex.ts:104`). Under that policy Codex keeps a `.git/` *directory* at the workspace root read-only, so a Codex agent in a plain checkout (a repository root) fails its first commit or branch rename:

```
fatal: Unable to create '<checkout>/.git/index.lock': Operation not permitted
```

Worktrees are fine: `.git` is a file there and the real git dir sits under the parent's `.git/worktrees/<id>`. So checkouts the framework makes (`.branches/<id>/`) work; a Codex agent in a non-owned checkout or its own clone does not.

Verified with codex-cli 0.144.4 on macOS: plain clone fails; the same with `-c 'sandbox_workspace_write.writable_roots=["<checkout>/.git"]'` commits; a worktree commits and renames with the default sandbox; a real task in a plain clone ended "I couldn't commit because this environment denies writes to `.git`".

**Proposal:** keep `workspace-write` and always pass the git common dir as a writable root: `-c sandbox_workspace_write.writable_roots=["<git rev-parse --git-common-dir>"]` next to `-C <cwd>`. Harmless in a worktree; fixes the plain checkout. Document why beside the driver.

## Why it matters

Any Codex agent outside a framework-made worktree silently loses its work's commit.

## Source

Imported from GitHub issue [framework/the-framework#1747](https://github.com/framework/the-framework/issues/1747), created 2026-08-29.
