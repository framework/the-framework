Priority: 7
Topics: [UX]
GitHub: [#1493](https://github.com/gemstack-land/the-framework/issues/1493)

# Paper cut: "Claude Code has not been trusted in this project"

## TLDR

A Claude web run cannot start a cloud session until `claude` has been run once in the project directory and its trust prompt accepted. Maintainer asks: is that one-time manual step avoidable — e.g. by using `--dangerously-skip-permissions`? Stated stance: UX is more important than safety for now.

## Why it matters

Any manual one-time setup step breaks the "click and it works" story for web runs, and this one surfaces as an opaque error to new users.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1493](https://github.com/gemstack-land/the-framework/issues/1493), created 2026-08-03, labels: `priority: high`, `UX ✨`, 0 comments.
