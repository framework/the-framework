priority: low
topics: [bug]

# What happens when removing (or renaming) a directory

## TLDR

When a project directory is removed or renamed, the framework doesn't refresh the project list — but it should. Low priority, post-MVP.

## Why it matters

Stale registry entries pointing at vanished paths make the dashboard lie about what exists, and likely cascade into other views (#1142 suspects its missing `Files` pane has this root cause). Defining the intended behavior (drop the entry? mark it gone? re-point?) is part of the fix.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1140](https://github.com/gemstack-land/the-framework/issues/1140), created 2026-07-25, labels: `bug`, `priority: low`.

### Original description

Seems like TF doesn't refresh the list (but should).

Low-prio, post-MVP.
