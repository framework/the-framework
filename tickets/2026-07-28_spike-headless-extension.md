Priority: 8
Topics: [UX]
GitHub: [#1332](https://github.com/gemstack-land/the-framework/issues/1332)

# Spike: Is it possible to make the extension headless?

## TLDR

The issue is title-only: spike whether the browser extension (the claude.ai bridge, see #1328) can run headless — i.e. without a visible, user-attended browser window.

## Why it matters

Labeled priority-high (was highest-prio at import). The extension path is the maintainer-chosen direction for web runs (#1328), and whether it can run headless determines how far it can scale (e.g. #1327's 10 concurrent sessions = 10 tabs) and whether it can run unattended on a daemon machine.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1332](https://github.com/gemstack-land/the-framework/issues/1332), created 2026-07-28, labels: `priority: high`, `UX ✨`, 1 comment. Body is empty; TLDR above is inferred from the title and the #1328 context.

### Notes from the GitHub thread

- Maintainer (2026-07-31): if headless turns out not to be possible, the fallback is to use the extension merely to siphon the claude.ai cookie.
