# Bug analysis: packages/framework/dashboard/components/ui/sheet.tsx

## Business logic (high-level)

The edge drawer (sheet.SPEC.md) on Base UI's Dialog: slides from left or right over a dimmed
backdrop, `w-3/4 max-w-sm` (up to three quarters of narrow screens, capped at 24rem — the SPEC's
"covering up to three quarters"), titled header, controlled by the caller. Light dismiss (Escape,
backdrop click) comes with Base UI's plain Dialog, which is what a drawer wants.

Composition notes:

- `side` picks `left-0 border-r` vs `right-0 border-l`; `inset-y-0 h-full` pins it to the full
  height. Correct.
- No close button is rendered by SheetContent. The sidebar's mobile usage passes
  `[&>button]:hidden` to hide a direct-child close button that upstream shadcn's Sheet renders —
  here it matches nothing; a harmless leftover selector, not a behavior difference (dismiss works
  via backdrop/Escape). Noted.
- No slide-in animation classes — the SPEC says "slides in", the code just shows it. Presentation
  nuance below the bug bar (no data-state transition classes exist anywhere in this port), and
  arguably "slides" describes the drawer idiom; not reported.
- `SheetHeader` is a plain div (used with `sr-only` in the sidebar to satisfy the dialog's
  accessible-name requirement via SheetTitle). `SheetTitle`/`SheetDescription` map to the
  primitive's Title/Description so aria wiring is automatic. Correct.

## Functions (low-level)

- `Sheet(props)` — Root passthrough (open/onOpenChange controlled). Correct.
- `SheetContent({ className, children, side = 'left', ...props })` — Portal > Backdrop > Popup;
  className merged after the side classes so callers (sidebar) can override width/padding.
  Correct.
- `SheetHeader` / `SheetTitle` / `SheetDescription` — presentation wrappers, props spread.
  Correct.

## Bugs found

None found.
