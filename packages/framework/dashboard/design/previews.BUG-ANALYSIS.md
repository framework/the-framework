# Bug analysis: packages/framework/dashboard/design/previews.tsx

## Business logic (high-level)

The gallery's card registry: each entry renders the REAL component where it can stand alone, so
"a card cannot quietly drift from what ships"; the hand-copied ones (portalled tooltip/menu
surfaces) are flagged `replica` and say so on the card. That anti-drift claim is the file's own
stated invariant, which makes stale prose on a card a defect by the file's own standard.

Audit of the cards against what ships:

- `ColorTokens` — 15 tokens listed; subtitle says "15 semantic tokens". Consistent.
- `StatusPalette` — five meanings, each a real utility (`bg-success` … `bg-primary`). Consistent.
- `TypeScale`, `RadiusScale` — self-contained samples. Fine.
- `Buttons` — renders default/outline/ghost variants and all five sizes of the REAL Button… but
  omits the `destructive` variant that ui/button.tsx ships, and closes with the claim "There is
  no destructive variant, so every irreversible action in the app … is styled ad hoc at the call
  site." That was true before #1032; today `button.tsx` has `variant: destructive` and
  ConfirmDialog uses it. The card now misstates the shipped kit — the exact drift the registry
  exists to catch. The card's registry subtitle "3 variants, 5 sizes, disabled" repeats the stale
  count. Bug 1.
- `Badges` — "The Badge primitive carries no variant prop" — still true of ui/badge.tsx; the
  status row hand-applies classes just like real call sites. Consistent.
- `Cards`, `StatTiles`, `EmptyStates` — real Card compositions; fine.
- `Disclosures` — real DisclosureToggle + OptionLabel with no-op onToggle (static gallery). Fine.
- `Overlays` — replica of the tooltip/menu popup class strings, flagged `replica: true` in the
  registry so the card shows the flag. The copied tooltip classes match ui/tooltip.tsx's popup
  classes; the menu-item replica is close enough for its purpose. Fine.

Registry shape: `width`/`height` fields are dead in the current pipeline — build.mts reads only
`path`, `group`, `name`, `subtitle`, `replica`, `node` (nothing else imports PREVIEWS). Either
DesignSync-side metadata that moved, or leftovers; harmless data, noted only.

## Functions (low-level)

- `Row` — label + wrapped flex row. Correct.
- `ColorTokens`/`StatusPalette`/`TypeScale`/`RadiusScale` — static maps over const tables; keys
  unique. Correct.
- `Buttons` — see bug 1. `Badges`/`Cards`/`StatTiles`/`Disclosures`/`Overlays`/`EmptyStates` —
  correct.
- `PREVIEWS` — paths unique, groups consistent; each node renderable via renderToStaticMarkup
  (no effects needed). Correct.

## Bugs found

1. `L177` (and the stale subtitle at `L354`): **The Button card claims "There is no destructive
   variant" and shows only 3 variants, but ui/button.tsx ships `destructive` (#1032) and
   ConfirmDialog uses it.** Scenario: a designer/reviewer reads the gallery card and concludes
   destructive styling is ad hoc per call site — the opposite of what ships; the gallery's own
   header says such drift is what it exists to catch. Severity: minor. Fix sketch: add
   `<Button variant="destructive">` to the Variants row, update the subtitle to "4 variants…",
   and drop or rewrite the trailing paragraph.

