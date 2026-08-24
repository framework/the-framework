# Bug analysis: packages/framework/dashboard/components/ui/dropdown-menu.tsx

## Business logic (high-level)

The dropdown menu kit (dropdown-menu.SPEC.md) on Base UI's Menu: grouped/labelled sections,
separators, right-opening submenus with a chevron, tickable entries, scroll-inside-itself via the
app's own ScrollArea, and a trigger that stays lit while open. Checked against the SPEC:

- **Tickable entries keep the menu open**: `DropdownMenuCheckboxItem` defaults
  `closeOnClick={false}` (and forwards a caller override). Plain `DropdownMenuItem` keeps Base
  UI's default close-on-click. Matches "several options in one pass".
- **Trigger stays lit**: `TRIGGER_OPEN_HIGHLIGHT` via `data-[popup-open]` on the trigger; also
  applied to submenu triggers (`data-[popup-open]:bg-…` in `DropdownMenuSubTrigger`). Matches.
- **Long menu scrolls with the app's bar**: `PopupBody` wraps items in `ScrollArea` with
  `max-h-[var(--available-height)]` on the viewport — `--available-height` is set by Base UI's
  Positioner, so the cap tracks the space the positioner allows. The item padding (`p-1`) moves
  inside the scroller as the comment says. Matches (#1046), and the height-cap-on-viewport rule
  matches scroll-area.tsx's documented constraint.

Prop-flow audit: in `DropdownMenuContent`/`SubContent`, `children` is destructured and rendered
inside `PopupBody`, while `{...props}` (minus children) spreads on `Menu.Popup` — no duplicate
children. `sideOffset`/`align` are lifted onto the Positioner, not leaked onto the Popup. Correct.

`DropdownMenuTrigger`: a function-form `className` (Base UI state callback) is passed through
*without* the open-highlight classes — a caller using the callback form opts out of the shared
highlight and owns its own styling; every current caller passes strings. Deliberate; noted.

## Functions (low-level)

- `PopupBody` — see above. Correct.
- `DropdownMenu`/`Group`/`Sub` re-exports — direct aliases; nothing to go wrong.
- `DropdownMenuTrigger` — highlight merge; see note. Correct.
- `DropdownMenuContent` — Portal > Positioner(z-50, sideOffset 6, align start) > Popup(POPUP_CLASS)
  > PopupBody. Correct.
- `DropdownMenuItem` — ITEM_CLASS (`data-[highlighted]`, `data-[disabled]` handling). Correct.
- `DropdownMenuCheckboxItem` — fixed-size indicator slot so labels align whether ticked or not;
  check icon inside `Menu.CheckboxItemIndicator` (only rendered when checked). Correct.
- `DropdownMenuSubTrigger` — chevron pushed by `ml-auto` (the comment explains why not
  justify-between). Correct.
- `DropdownMenuSubContent` — side="right", align="start", offset 2. Correct.
- `DropdownMenuSeparator` / `DropdownMenuLabel` — presentation only. Correct.

## Bugs found

None found.
