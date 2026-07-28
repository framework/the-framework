shadcn "sheet" built on Base UI's Dialog (no Radix): an edge-anchored full-height drawer with backdrop, used as the sidebar's mobile off-canvas presentation.

## Facts

- `SheetContent` takes `side: 'left' | 'right'` (default left), sizing `w-3/4 max-w-sm`; open state is controlled by the caller via `open`/`onOpenChange` on the Root.
- Exports `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription` — Title/Description are Base UI Dialog parts, which the sidebar renders `sr-only` for accessibility.
