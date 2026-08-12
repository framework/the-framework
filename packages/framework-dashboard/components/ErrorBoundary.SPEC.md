The net under the whole dashboard: a crash while drawing any view shows a recoverable "Something went wrong" card instead of the blank white screen that used to take the entire app down.

## TLDR

- The error is shown on the card and its details logged to the browser console — the one trace a data-driven "random" crash leaves, since the daemon never sees it.
- "Try again" redraws the view, which recovers when the cause was transient; Reload sits beside it as the sure way out — and the session and daemon keep running either way.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
