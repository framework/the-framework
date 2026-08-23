A scrollable region with the dashboard's own scrollbar instead of the operating system's, used wherever a panel holds more than it can show — the sidebar's rails, dropdown menus, popovers.

## Business logic — TL;DR

- **The bar is always visible while there is more to see** - the operating system's overlay scrollbar hides itself, which leaves a panel looking as if it held nothing beyond its edge; this one stays drawn for as long as the content overflows, and darkens under the pointer.
- **No bar when nothing overflows** - the scrollbar disappears entirely once the content fits, so a short list is not decorated with a dead rail.
- **The region is not a control** - it can be focused so the keyboard can scroll it, but it never draws the focus ring that the dashboard's buttons and fields draw, which would otherwise outline a whole panel edge in green.
- **Vertical only** - nothing in the dashboard scrolls sideways, so no horizontal bar exists.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
