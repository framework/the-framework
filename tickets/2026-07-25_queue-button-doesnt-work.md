Priority: 8
Topics: [bug]
GitHub: [#1164](https://github.com/gemstack-land/the-framework/issues/1164)

# `Queue` button doesn't seem to work?

## TLDR

Clicking the `Queue` button on a session appears to do nothing beyond a small UI change (screenshots in the issue) — the session doesn't visibly get queued or picked up. Still reproducing hours later ("Still having this issue. What should I do now?"), so beyond the fix, the queued state needs to communicate what happens next.

## Why it matters

The queue (#624) is the core mechanism for lining up AI work; a queue entry point that silently no-ops dead-ends the main dashboard flow and leaves the user stranded without feedback. Related: #1161 ("Queue doesn't work?", closed).

## Source

Imported from GitHub issue [gemstack-land/the-framework#1164](https://github.com/gemstack-land/the-framework/issues/1164), created 2026-07-25, labels: `bug`, `priority: high`, 1 comment.

### Original description

I clicked on `Queue`:
<img width="433" height="127" alt="Image" src="https://github.com/user-attachments/assets/7446d24d-29ec-457e-8cd8-f9c966e2b3b6" />

All it seems to do is this:

<img width="753" height="193" alt="Image" src="https://github.com/user-attachments/assets/afb2d12e-616e-4c7c-a694-0d6020ca673e" />

So I don't think it works?

### Notes from the GitHub thread

- Still reproducing later the same day (new screenshot), with the added confusion "What should I do now?" — the queued state gives no guidance on what happens next.
