shadcn's "base" (Base UI, not Radix) Sidebar kit, ported near-verbatim for the dashboard's rail/shared shell (#314): provider + context, the sidebar shell with desktop/mobile/none modes, and the full menu part family.

## TLDR

- Exports ~23 parts: `SidebarProvider`/`useSidebar`, `Sidebar`, `SidebarTrigger`, `SidebarRail`, `SidebarInset`, `SidebarInput`, `SidebarHeader`/`Footer`/`Separator`/`Content`, `SidebarGroup(+Label/Action/Content)`, `SidebarMenu(+Item/Button/Action/Badge/Skeleton/Sub/SubItem/SubButton)`.
- `SidebarProvider` owns state (`expanded`/`collapsed` + separate `openMobile`), supports controlled `open`/`onOpenChange`, binds Cmd/Ctrl+B to toggle, persists desktop state in a cookie, sets `--sidebar-width` vars, and wraps children in `TooltipProvider delay={0}`.
- `Sidebar` renders three ways: `collapsible='none'` → plain column; mobile (`useIsMobile`, <768px) → off-canvas `Sheet` at 18rem with `sr-only` header; desktop → a width-animating "gap" div plus a fixed container, with `data-state`/`data-collapsible`/`data-variant`/`data-side` attributes driving all Tailwind styling.
- `SidebarMenuButton` optionally wraps itself in a Tooltip that is `hidden` unless collapsed on desktop — the flyout label for icon mode.
- Polymorphism via Base UI's `useRender` `render` prop (menu buttons default `<button/>`, sub-buttons `<a/>`).

## Decisions

- Only deviations from upstream shadcn: repo's `cn`/`Button`/`Tooltip`; the collapsed-state tooltip passes `side`/`align` straight to `TooltipContent` (Portal + Positioner live inside it) instead of a separate TooltipPositioner; the mobile branch does not forward the wrapper's div props onto the Sheet's Dialog root.
- `SidebarMenuSkeleton` seeds its pseudo-random text width from `React.useId` char codes instead of `Math.random`, so the width is stable across renders (upstream re-rolls on mount).

## Facts

- Constants: width 16rem expanded, 3rem icon-collapsed, 18rem mobile; cookie `sidebar_state` with 7-day max-age; shortcut key `b` (with meta/ctrl).
- `variant`: `sidebar` | `floating` | `inset` (inset pairs with `SidebarInset`'s margined `<main>`); `collapsible`: `offcanvas` | `icon` | `none`.
- `--sidebar-*` color tokens live in `layouts/tailwind.css`; parts carry both `data-slot` and legacy `data-sidebar` attributes.
- `useSidebar` throws outside `SidebarProvider`.

## Flows

- Toggle: `SidebarTrigger` click / `SidebarRail` click / Cmd+B → `toggleSidebar()` → mobile ? `setOpenMobile` : `setOpen` → cookie write → `data-state`/`data-collapsible` flip → CSS width/position transitions (desktop) or Sheet open/close (mobile).
- Collapsed icon mode: `data-collapsible=icon` → group labels/actions/badges/subs hide, buttons shrink to `size-8`, `SidebarMenuButton` tooltips un-hide to the right.
