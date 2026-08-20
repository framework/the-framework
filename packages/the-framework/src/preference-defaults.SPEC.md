The shared defaults and bounds for user preferences, written down once so the dashboard and the daemon act on the same values.

## Flows

- Notifications are a 2×2 with the axes named: *how* one reaches you (browser, Discord) and *what it is about* (needs-you, plain activity). Delivering a cell asks one question: both its method and its category must be on.
- The polarities are not uniform, and that is the point of writing them once: the browser bell and the "needs you" baseline fire unless turned off, while anything that reaches outward (Discord) or is loosely informative is opt-in.
- The bounds and defaults for the automatic-spend slider and the auto-PM concurrency — one number each that both the browser control and the daemon's sanitizer read.

## Rationales

- Composing a delivery in one place is what prevents the copied-sibling mistake: nothing in the four stored key names says which axis a key belongs to, and a delivery decision open-coded per surface is how a category's polarity gets copied wrong from its sibling.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
