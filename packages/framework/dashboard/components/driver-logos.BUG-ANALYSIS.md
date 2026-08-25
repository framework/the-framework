# Bug analysis: packages/framework/dashboard/components/driver-logos.tsx

## Business logic (high-level)

Monochrome brand logomarks for the two coding drivers (#656), used by the driver/model menu, the
Sessions rail, and anywhere a `DriverName` needs a mark. Design contract (from the header comment):
inherit text color (`fill="currentColor"`), size via `className`, decorative by default with the
accessible name carried by the visible label — unless `title` is passed, in which case the SVG
becomes a named image.

Accessibility invariant verified: with `title` → `role="img"` plus an SVG `<title>` child (the
accessible name); without → `aria-hidden="true"`. Both branches are correct ARIA usage, and the
two are mutually exclusive by construction (`labelProps` returns exactly one of them).

No state, no effects, no inputs beyond props — failure modes are limited to a wrong mapping or a
broken path. The path data is opaque brand geometry (Claude starburst, OpenAI knot) inside a
`0 0 24 24` viewBox; both parse as single closed `<path>` elements — nothing checkable beyond
well-formedness, which holds.

## Functions (low-level)

- **`ClaudeLogo({ className, title })`** — starburst mark (deliberately the product mark, not the
  Anthropic wordmark — comment documents the distinction). Correct.
- **`CodexLogo({ className, title })`** — OpenAI mark. Correct.
- **`labelProps(title)`** — decorative-vs-named switch as above. Correct.
- **`DriverLogo({ driver, className, title })`** — `'codex'` → CodexLogo, anything else →
  ClaudeLogo. `DriverName` is the closed union `'claude' | 'codex'`, so the else-branch default is
  exhaustive today and fails soft (Claude mark) if the union ever grows — acceptable for a visual.
  The conditional `{...(title ? { title } : {})}` avoids passing `title: undefined`, equivalent
  either way given `LogoProps` accepts undefined. Correct.

## Bugs found

None found.
