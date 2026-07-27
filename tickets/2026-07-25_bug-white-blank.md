Status: open
Priority: 8
GitHub: [#1194](https://github.com/gemstack-land/the-framework/issues/1194)

# Bug: white blank

## TLDR

The UI sometimes goes fully blank (white screen), seemingly at random. Narrowed in-thread: it's related to the 'Serve Action', with a deterministic repro — hovering the "Serve" menu item. #1196 was explicitly a mitigation, not a root-cause fix; this issue stays open for the real fix.

## Why it matters

A random white screen is the worst kind of dashboard failure — total loss of UI with nothing surfaced. With the hover repro in hand, the root-cause fix is now tractable.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1194](https://github.com/gemstack-land/the-framework/issues/1194), created 2026-07-25, label: `priority: high`, 4 comments.

### Original description

Bug: the UI sometimes goes blank (just a white screen), seems to be random.

### Notes from the GitHub thread

- Related to the 'Serve Action'; deterministic repro confirmed by the maintainer: hover the "Serve" menu item.
- Per the #1196 discussion: that PR is a mitigation, not a root-cause fix — this issue was deliberately kept open.
