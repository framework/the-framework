# Bug analysis: packages/framework/dashboard/components/ui/message-scroller.test.tsx

## Business logic (high-level)

Pins the one thing the #914 port can silently lose: the viewport's scrollbar/fade utility classes,
and — the sharper half — that every `scrollbar-*` / `scroll-fade*` utility the component asks for
is actually *defined* in `tailwind.css` ("a class the stylesheet does not define is silently
nothing, which is exactly how the styling went missing the first time"). That second test is a
real drift tripwire: it fails if either side (component class list, stylesheet `@utility` blocks)
changes without the other.

Do the tests verify what they claim?

- Test 1 asserts the four class tokens on the rendered viewport — direct and honest; it renders
  through the real Provider so the primitive's context requirement is satisfied.
- Test 2 derives the asked-for utilities from the *rendered* className (splitting variants on `:`
  and taking the last segment, so `data-autoscrolling:scrollbar-quiet` → `scrollbar-quiet`),
  filters to the two prefixes, guards against an empty list (`asked.length > 0` — the test cannot
  silently pass by matching nothing), and requires the exact `@utility <name> {` text in
  tailwind.css. The `token.split(':').at(-1) ?? ''` never yields undefined (split always returns
  ≥1 element), and the per-assertion `expect(tailwind, utility)` labels failures. Sound.
- Cwd reliance: `readFileSync('tailwind.css')` depends on vitest's cwd being the dashboard
  package; the comment says the package's `test` script cds there for exactly this reason, and
  `import.meta.url` is indeed not a file URL under this jsdom setup. Reliance documented in the
  test itself; fine.
- Environment reliance: rendering `MessageScrollerViewport` under only the Provider (no Root)
  must be supported by the primitive — if a future primitive version required the Root, the tests
  would fail loudly, not pass wrongly.

## Functions (low-level)

- `viewport()` — renders and returns the `[data-slot="message-scroller-viewport"]` element,
  throwing when absent (loud failure, no `!`). `afterEach(cleanup)` prevents cross-test DOM
  bleed. Correct.
- `tailwind` constant — read once at module load; fine for a read-only asset.

## Bugs found

None found.
