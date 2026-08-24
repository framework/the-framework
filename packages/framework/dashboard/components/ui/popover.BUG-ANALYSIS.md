# Bug analysis: packages/framework/dashboard/components/ui/popover.tsx

## Business logic (high-level)

The rich floating panel (popover.SPEC.md) on Base UI's Popover, sharing the dropdown menu's
surface and manners: same POPUP-style classes, trigger lit while open via `data-[popup-open]`, and
a too-tall panel scrolling inside the app's ScrollArea capped at the positioner's
`--available-height`. All three SPEC promises check out in the code.

Prop-flow audit mirrors dropdown-menu: `children` render inside the ScrollArea's padded body,
`{...props}` (children excluded) spreads on the Popup; `sideOffset`/`align` lift onto the
Positioner. `children as ReactNode` cast exists because Base UI's Popup children type allows a
render-function form this wrapper deliberately does not support — callers pass nodes.

`PopoverTrigger` has the same function-className passthrough as DropdownMenuTrigger: a callback
form skips the shared open-highlight (caller owns styling). Deliberate; every current caller
passes strings.

## Functions (low-level)

- `Popover` — alias of `BasePopover.Root`. Correct.
- `PopoverTrigger` — highlight merge or passthrough; see note. Correct.
- `PopoverContent` — Portal > Positioner(z-50, default sideOffset 6 / align 'start') >
  Popup(card surface) > ScrollArea(viewport max-h var(--available-height)) > `p-3` body.
  The z-index sits on the Positioner (the positioned element), consistent with the tooltip #1506
  lesson. Verdict: correct.

## Bugs found

None found.
