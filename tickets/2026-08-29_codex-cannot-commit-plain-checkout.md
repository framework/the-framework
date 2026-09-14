Topics: [bug]
GitHub: [#1747](https://github.com/framework/the-framework/issues/1747)

# Codex cannot commit in a plain checkout: the default sandbox refuses writes under .git/

## TLDR

The Codex driver runs `codex exec --sandbox workspace-write` (`packages/agent-driver/src/codex.ts:104`). That policy keeps a `.git/` **directory** at the workspace root read-only, so a Codex agent in a plain checkout (a repository root) fails its first commit or branch rename with `Unable to create '.git/index.lock': Operation not permitted`. Worktrees are fine: `.git` is a file there and the real git dir sits outside the root. What breaks is the non-owned-checkout run (told to `git checkout -b agent-<name>` and commit) and any agent in its own clone. Verified on codex-cli 0.144.4, macOS.

**Proposal:** keep `workspace-write` and always pass the checkout's git common dir as a writable root, `-c sandbox_workspace_write.writable_roots=["<git rev-parse --git-common-dir>"]`, next to `-C <cwd>`. It is harmless in a worktree and fixes the plain checkout. Verified: with that root, the commit succeeds. `codex.SPEC.md` gets a sentence saying why.

## Why it matters

A Codex agent in a plain checkout cannot publish anything: it edits the files and then reports that it couldn't commit.

## Source

Imported from GitHub issue [framework/the-framework#1747](https://github.com/framework/the-framework/issues/1747), created 2026-08-29, no labels, 0 comments.
