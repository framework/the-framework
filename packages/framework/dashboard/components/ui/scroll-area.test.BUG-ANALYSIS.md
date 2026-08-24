# Bug analysis: packages/framework/dashboard/components/ui/scroll-area.test.tsx

## Business logic (high-level)

Pins the #913 port's contract at the level jsdom can honestly test (the header comment says so
explicitly: bar size/visibility is layout, out of scope): children land inside the real scrolled
viewport, the viewport is reachable by ref, the thumb is token-themed (not the OS bar), and the
bar is a slim vertical strip.

Do the tests verify what they claim?

- "puts its children in the scrolled viewport" — queries the viewport by data-slot and asserts
  `contains(...)` on the actual text node. Real containment, not just presence. Sound.
- "hands the viewport out by ref" — callback ref captured and compared by identity against the
  DOM query. `el => void (viewport = el)` returns undefined so React does not treat it as a
  cleanup-returning ref. Sound.
- "thumb from our tokens" — asserts `bg-muted-foreground/40` + `rounded-full` on the thumb's
  className. Class-string pinning, same technique as the message-scroller test; it would catch a
  retune to the border token (the regression the comment cites).
- "slim vertical strip" — asserts `h-full w-2.5` and `data-orientation="vertical"` (the latter
  rendered by Base UI from the `orientation` prop, so it checks the prop actually reached the
  primitive). Sound.

Environment reliance: these assume Base UI renders the Scrollbar/Thumb in jsdom even though
nothing overflows (layout is all zero there). With the installed Base UI version it does (the
tests are green in CI per the repo's practice); if a future version deferred rendering until
overflow, the tests would fail loudly — they cannot pass vacuously since `expect(undefined)
.toContain` throws. Acceptable.

`afterEach(cleanup)` prevents duplicate-element queries across tests.

## Functions (low-level)

- No helpers beyond inline queries; each test self-contained. Correct.

## Bugs found

None found.
