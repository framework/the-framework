Status: open
Priority: 8
GitHub: [#1194](https://github.com/gemstack-land/the-framework/issues/1194)

# Bug: white blank

## TLDR

The UI sometimes goes fully blank (just a white screen), seemingly at random. Narrowed down in-thread: it's related to the 'Serve Action' — reliably reproducible by hovering the "Serve" menu item in the session actions dropdown.

## Why it matters

A whole-page white-screen is the worst class of UI bug, and it's triggered by merely hovering a menu item. With a known reproduction it should be quick to root-cause (likely a render error in the Serve action's hover path). Priority high.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1194](https://github.com/gemstack-land/the-framework/issues/1194), created 2026-07-25, label: `priority: high`, 4 comments.

### Original description

Bug: the UI sometimes goes blank (just a white screen), seems to be random.

### Notes from the GitHub thread

- "Its related to the 'Serve Action'" (screenshot of the actions dropdown).
- Confirmed reproduction: "Indeed, I can reproduce by hovering the 'Serve' menu item."
