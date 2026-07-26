Status: open
GitHub: [#1170](https://github.com/gemstack-land/the-framework/issues/1170)

# Where can I see the user prompt?

## TLDR

The log view shows TF's system prompt but the sent user prompt wasn't obvious. Resolved in-thread: it is shown next to `YOU`. Remaining asks: highlight it in blue, and — if quick-win — show it as the first log entry. Only if quick-win.

## Why it matters

Small log-readability polish: the user prompt is the single most important piece of context when reading a session log, and today it doesn't stand out.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1170](https://github.com/gemstack-land/the-framework/issues/1170), created 2026-07-25, no labels, 1 comment.

### Original description

In the following I can see TF's sys prompt, but I don't see the sent user prompt.

<img width="934" height="602" alt="Image" src="https://github.com/user-attachments/assets/265c4d3a-fb54-49e5-bf13-127135cbe6fe" />

Only if quick-win.

### Notes from the GitHub thread

- Found: "Ah, it's written next to `YOU`. Nice." — remaining work is to highlight it in blue, and (if quick-win) show it as the first log entry.
