Priority: 2
Topics: [bug]
GitHub: [#1142](https://github.com/gemstack-land/the-framework/issues/1142)

# Bug: `Files` missing

## TLDR

The `Files` element is missing in the dashboard (screenshot in the issue). Root cause located (triage 2026-08-24): the tab hides whenever the file list is empty (`RightRail.tsx:106`), so a moved/renamed directory (#1140) or a failed listing drops it silently. Low priority, post-MVP.

## Why it matters

A hidden tab is indistinguishable from "no files": the hide-on-empty behaviour at `RightRail.tsx:106` silently swallows both the stale-directory case (#1140) and any failed listing. Fixing #1140 alone won't cover the failed-listing path — the hide-on-empty rendering is the thing to change (show an empty/error state instead).

## Source

Imported from GitHub issue [gemstack-land/the-framework#1142](https://github.com/gemstack-land/the-framework/issues/1142), created 2026-07-25, labels: `bug`, `priority: low`.

### Original description

Low-prio, post-MVP.

I suspect it's related to:
- https://github.com/gemstack-land/the-framework/issues/1140

<img width="1366" height="384" alt="Image" src="https://github.com/user-attachments/assets/09bb83d1-b4e8-45a3-975c-b35cd2d0b373"/>
