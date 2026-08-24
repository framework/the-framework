# Bug analysis: packages/framework/dashboard/components/ui/scroll-area.tsx

## Business logic (high-level)

The app-owned scrollbar region (scroll-area.SPEC.md) on Base UI's ScrollArea. SPEC promises vs
code:

- **Bar visible while content overflows, gone when it fits** — delegated to Base UI (the
  scrollbar unmounts when not needed; `keepMounted` not set). The thumb darkens on hover
  (`hover:bg-muted-foreground/70`). Matches.
- **Region is not a control** — viewport keeps focusability (Base UI default) but styles
  `outline-none`, per the SPEC's explicit "never draws the focus ring" decision. Matches.
- **Vertical only** — one `ScrollBar` with `orientation="vertical"`; a `Corner` is rendered
  although without a horizontal bar it never shows content (harmless; upstream parity).
- **Height-cap contract** — the important subtlety, documented on `viewportClassName`: a cap must
  go on the viewport, since the viewport's `h-full` cannot resolve a Root `max-h-*`. When
  `viewportClassName` is given it *replaces* `h-full` (`viewportClassName ?? 'h-full'`) rather
  than merging — so a caller passing only e.g. `max-h-32` also drops `h-full`. That is the
  intended semantics (capped viewports size to content up to the cap; definite-height Roots use
  the default), and all callers read consistently with it (dropdown/popover/editor pass caps,
  rails use the default). Correct, but worth knowing: passing an unrelated viewport class silently
  removes `h-full`.

## Functions (low-level)

- `ScrollArea({ className, children, viewportRef, viewportClassName, ...props })` — Root
  (`relative` + overrides, rest of Root.Props spread) > Viewport (ref forwarded for
  self-scrolling rails, `rounded-[inherit]`) > children, then ScrollBar + Corner as Root
  siblings of the viewport (Base UI reads context). Edge cases: `viewportRef` optional; no
  horizontal overflow handling by design. Verdict: correct.
- `ScrollBar({ className, ...props })` — vertical scrollbar strip (w-2.5, transparent left
  border as inset) with the muted-foreground thumb. Exported for composition; orientation
  hardcoded vertical before the spread, so a caller could override via props — none does.
  Verdict: correct.

## Bugs found

None found.
