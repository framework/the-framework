The dashboard's shadcn-style primitive library: hand-ported, trimmed shadcn components built on Base UI (never Radix), themed via the repo's CSS-var tokens.

## TLDR

- `badge.tsx` — rounded-full status pill span.
- `button.tsx` — cva Button (default/outline/ghost/destructive; incl. icon sizes), exports `buttonVariants`.
- `card.tsx` — Card/CardHeader/CardTitle/CardContent panel surface.
- `checkbox.tsx` — Base UI Checkbox replacing hand-rolled native inputs.
- `confirm-dialog.tsx` — AlertDialog confirm flow wired through `useAction` (busy/error in place, no light-dismiss).
- `copy-button.tsx` — clipboard icon button with 1.5s "Copied" flash + tooltip.
- `dialog.tsx` — plain centered modal (Esc/backdrop close) for small forms.
- `dropdown-menu.tsx` — Menu family; popups scroll through ScrollArea, triggers lit via `data-popup-open`.
- `input.tsx` — themed text input; base of `SidebarInput`.
- `message-scroller.tsx` (+ `.test.tsx`) — styled wrappers over `@shadcn/react`'s message-scroller primitive (follow-live-edge chat viewport, "Jump to latest" button); test pins the local scrollbar-utility pairing (#914).
- `option-label.tsx` — menu label + one-line description (#654).
- `popover.tsx` — floating rich-content panel, same surface/scroll recipe as the menus.
- `scroll-area.tsx` (+ `.test.tsx`) — themed always-visible scrollbar component (#913); test pins viewport structure and token-toned thumb.
- `separator.tsx` — thin divider.
- `sheet.tsx` — edge-anchored drawer on Base UI Dialog; the sidebar's mobile presentation.
- `sidebar.tsx` — the full shadcn Sidebar kit (provider/context, desktop+mobile+icon-collapse shell, menu parts) — the directory's one big orchestrator.
- `skeleton.tsx` — pulsing placeholder block.
- `tooltip.tsx` — instant-open (delay 0, #1149) tooltip; Portal/Positioner inside TooltipContent.

## Decisions

- Every primitive is Base UI (`@base-ui-components/react`) — no Radix anywhere; ports are done by hand because the repo has no shadcn `components.json` (#712/#913), trimmed to what the dashboard actually uses.
- Native/OS scrollbars are banned (#710): overflow goes through `ScrollArea` or the local `scrollbar-*` `@utility` classes in `layouts/tailwind.css`.
- Two dialog tiers on purpose: `ConfirmDialog` (AlertDialog, focus-trapped, no light-dismiss) for irreversible actions vs `Dialog`/`Sheet` (plain Dialog, light-dismiss) for forms and navigation.

## Facts

- Shared popup surface recipe: border + `bg-card` + shadow (there is no `--color-popover` token — card stands in); open triggers highlight via `data-[popup-open]` accent classes.
- Styling hooks are `data-slot="…"` attributes (what the tests query); state styling rides Base UI `data-*` attributes (`data-highlighted`, `data-checked`, `data-state`, …).
- `cn` (in `lib/utils.ts`) is clsx + tailwind-merge; theme tokens are `--color-*`/`--sidebar-*` CSS vars from `layouts/tailwind.css`.
