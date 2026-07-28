shadcn "base" popover on Base UI (not Radix) — the floating panel for rich content a menu can't hold, e.g. the Enhanced System Prompt's checkboxes + prompt preview (#1046).

## Facts

- Same surface recipe as the dropdown menu: border + `bg-card` + shadow on the Popup, body scrolled through the local `ScrollArea` capped at `max-h-[var(--available-height)]` (Base UI's positioner variable).
- `PopoverTrigger` stays lit while open via `data-[popup-open]` accent classes, matching the menus; a function `className` (Base UI callback form) is passed through untouched.
- `PopoverContent` defaults `sideOffset={6}`, `align='start'` and pads the body `p-3`.
