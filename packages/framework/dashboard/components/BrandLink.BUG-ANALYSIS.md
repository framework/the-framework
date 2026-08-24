# Bug analysis: packages/framework/dashboard/components/BrandLink.tsx

## Business logic (high-level)

The brand as the way home. Checked against `BrandLink.SPEC.md`:

- **Real link semantics** — a genuine `<a href="/">`; the click handler defers to the browser
  for `metaKey || ctrlKey || shiftKey || altKey || button !== 0` (returns without
  `preventDefault`, so cmd-click/new-tab/copy-address all behave natively) and intercepts only
  the plain primary click (`preventDefault()` + `onNavigate()` → the shell's client-side
  `go`). ✓ Exactly the SPEC's split. (Middle-click in modern browsers fires `auxclick`, not
  `click`, so the `button !== 0` guard is mostly a jsdom/defensive path — harmless and pinned
  by the test.)
- **Way home** — logo + wordmark are one target; `onNavigate` is supplied by the shell as
  `onDashboard`. ✓
- **Working indicator** — `working` passed through to `Logo`, which switches its fill/animation.
  ✓ (The rendering itself is Logo's contract.)
- **Responsive** — wordmark `hidden sm:inline`; the mark has no hide class. ✓

Edge cases: keyboard activation (Enter on the focused link) produces a click event with
`button === 0` and no modifiers → in-app navigation, correct; screen-reader name comes from
the wordmark text (hidden-below-sm via CSS still leaves it in the accessibility tree on
desktop; below sm the accessible name degrades to the SVG — acceptable, and the SPEC only
demands the logo remain the way home). No state, no effects.

## Functions (low-level)

- **`BrandLink({ working, onNavigate })` (L8)** — single anchor render; handler logic analyzed
  above. Inputs are required props (no undefined branches). Output: anchor with Logo + span.
  Verdict: correct.

## Bugs found

None found.
