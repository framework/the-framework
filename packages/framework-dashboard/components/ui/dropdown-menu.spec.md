shadcn "base" dropdown menu on Base UI's Menu (not Radix), trimmed to what the Start form's preset and agent/model menus need (#649/#650), themed with the dashboard's CSS-var tokens.

## TLDR

- Re-exports `Menu.Root/Group/SubmenuRoot` as `DropdownMenu`/`DropdownMenuGroup`/`DropdownMenuSub`; wraps Trigger, Content, Item, CheckboxItem, SubTrigger, SubContent, Separator, Label.
- Every popup shares `POPUP_CLASS` (border + `bg-card` + shadow) and a `PopupBody`: a `ScrollArea` capped at `max-h-[var(--available-height)]` with `p-1` items padding.
- Sub-menus open to the right (`side="right" align="start" sideOffset={2}`); top-level content defaults `sideOffset={6} align='start'`.

## Decisions

- Scroll moves inside the local `ScrollArea` so a long menu shows the thin themed overlay bar (#1046) instead of the OS one, whose grey track read as a second layer beside the border; #710 stands — no native scrollbar comes back.
- `TRIGGER_OPEN_HIGHLIGHT` keeps a trigger lit while its menu is open via `data-[popup-open]` (#1046), defined once so every menu button (presets, agent/model, gear, Context, notifications) behaves the same; a function-form `className` bypasses it.
- `DropdownMenuCheckboxItem` defaults `closeOnClick={false}` so several options can be flipped in one open.
- SubTrigger's chevron is pushed right by its own `ml-auto`, not `justify-between` on the row: justifying spaced out *every* child, centring plain-text labels between icon and chevron unless callers remembered a `flex-1` wrapper.

## Facts

- There is no `--color-popover` token in the theme — the card surface stands in.
- Item highlight state is `data-highlighted`; an open submenu trigger is `data-popup-open`.
