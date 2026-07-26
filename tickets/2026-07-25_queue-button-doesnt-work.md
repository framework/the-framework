Status: open
Priority: 8
Topics: [bug]
GitHub: [#1164](https://github.com/gemstack-land/the-framework/issues/1164)

# `Queue` button doesn't seem to work?

## TLDR

Clicking the `Queue` button appears to do nothing useful — all it visibly does is the small change in the second screenshot, and the user is left wondering whether anything was queued. Still reproducible hours later ("Still having this issue. What should I do now?"), so the button either doesn't work or gives no feedback about what it did and what the next step is.

## Why it matters

Queueing is a core dashboard flow; a primary button that silently no-ops (or works invisibly) dead-ends the user and erodes trust in the whole UI. Priority high. Whoever picks this up should fix both halves: make the queue action actually take effect, and make its effect and the follow-up step visible.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1164](https://github.com/gemstack-land/the-framework/issues/1164), created 2026-07-25, labels: `bug`, `priority: high`, 1 comment.

### Original description

I clicked on `Queue`:
<img width="433" height="127" alt="Image" src="https://github.com/user-attachments/assets/7446d24d-29ec-457e-8cd8-f9c966e2b3b6" />

All it seems to do is this:

<img width="753" height="193" alt="Image" src="https://github.com/user-attachments/assets/afb2d12e-616e-4c7c-a694-0d6020ca673e" />

So I don't think it works?

### Notes from the GitHub thread

- Still happening later the same day: "Still having this issue. What should I do now?" (screenshot: https://github.com/user-attachments/assets/a9b9d195-2b79-4929-8fbf-49e0fd0b4f84) — the missing "what happens next" affordance is part of the bug.
