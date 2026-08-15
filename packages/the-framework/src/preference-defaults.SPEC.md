The shared defaults and bounds for user preferences, written down once so the dashboard and the daemon act on the same values.

## TLDR

- Notifications are a 2×2 with the axes named: *how* one reaches you (browser, Discord) and *what it is about* (needs-you, plain activity). Nothing in the four stored key names said which axis a key belonged to, and composing them was open-coded per call site — which is how one got a category's polarity wrong by copying its sibling. Delivering a cell asks one question here instead.
- The polarities are not uniform, and that is the point of writing them once: the browser bell and the "needs you" baseline fire unless turned off, while anything that reaches outward (Discord) or is loosely informative is opt-in.
- The bounds and defaults for the automatic-spend slider and the auto-PM concurrency — one number each that both the browser control and the daemon's sanitizer read.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
