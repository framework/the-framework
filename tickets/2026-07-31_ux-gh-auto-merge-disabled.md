Priority: 8
Topics: [UX]
GitHub: [#1417](https://github.com/gemstack-land/the-framework/issues/1417)

# UX when GH auto-merge is disabled

## TLDR

Handle gracefully the case where a user's repo doesn't have GitHub auto-merge enabled — which is the default for new repos (it was for TF's own; see #1406 for the consequence: merges land before CI). Idea from the OP: a GH-webhook mechanism listening to GitHub events (#1418, since closed) could power auto-merge. Known bug from the thread: the #1443 warning never shows — its probe `gh repo view --json autoMergeAllowed` always fails (that JSON field doesn't exist in `gh repo view`), and the failure counts as "could not say", which never warns. Fix: probe `gh api repos/{owner}/{repo}` and read `allow_auto_merge` (verified to return `false` on this repo); a PR was announced.

## Why it matters

High-prio for MVP USER (post MVP YC): on the default repo config, auto-merge silently degrades to merge-before-CI, which shapes every new user's first impression of whether autonomous merging is safe.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1417](https://github.com/gemstack-land/the-framework/issues/1417), created 2026-07-31, labels: `priority: high`, `UX ✨`, 1 comment.
