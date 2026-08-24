# Bug analysis: packages/framework/dashboard/components/ui/card.tsx

## Business logic (high-level)

The panel primitive (card.SPEC.md): a bordered rounded surface (`Card`), an optional header
(`CardHeader` + `CardTitle`) and a body (`CardContent`), so every dashboard panel is framed the
same. Pure presentation; the only structural choice is `CardTitle` rendering an `h3` (a fixed
heading level — fine for a flat dashboard, and the SPEC says nothing about levels).

Note: `CardHeader` uses `px-4 pt-4` (no bottom padding) and `CardContent` `p-4`, so a
header+content card has consistent spacing; a header-less card just uses `CardContent`. The
gallery (design/previews.tsx) renders both compositions and they look intentional.

## Functions (low-level)

- `Card` — `rounded-lg border bg-card text-card-foreground` + overrides. Correct.
- `CardHeader` — flex column, gap, top/side padding. Correct.
- `CardTitle` — `h3.text-sm.font-semibold`, props spread (children required by usage). Correct.
- `CardContent` — `p-4` + overrides. Correct.

All four: empty children, extra classes, event handlers pass through; nothing stateful to race.

## Bugs found

None found.
