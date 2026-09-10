Provides the dashboard's sidebar shell: a side column that can be expanded or collapsed by a toggle button, a grab strip along its edge, or Cmd/Ctrl+B, that turns into a slide-in drawer on a narrow screen, and whose rows, groups, badges, tooltips and loading placeholders follow the collapsed state. The dashboard's one sidebar, rendered by `AgentHistory.tsx`, uses the non-collapsible form, so today it is a fixed-width column that is always visible and the collapsing, drawer and shortcut rules below stay dormant.

## Context

**User story**: the dashboard has no top bar; the sidebar holds the brand, the global navigation and the list of agents [1], so the user reaches every page from it and can fold it away to give the workspace the full width.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.

## Business logic — TL;DR

- **Expanded or collapsed, toggled three ways** - the sidebar starts expanded unless its host says otherwise; the "Toggle Sidebar" button, the grab strip on its edge and Cmd/Ctrl+B anywhere on the page flip it.
- **Three collapsing modes** - off-canvas slides the sidebar fully out of view, icon mode shrinks it to a narrow strip of icons and hides everything that needs width, and the non-collapsible mode keeps it as a fixed column.
- **A drawer on a narrow screen** - narrower than 768 pixels, the sidebar becomes a drawer that slides in from its side, closed by default and opened by the same toggles.
- **The state is written to a cookie that nothing reads** - every toggle records the state in a `sidebar_state` cookie kept for seven days, but the dashboard never reads it back, so a reload starts from the default again.
- **Rows follow the collapsed state** - a row can be marked active, comes in three sizes, shows its tooltip only while the sidebar is collapsed to icons, may carry a badge, a hover-only action and a nested sub-list, and has a placeholder row for loading.

## Business logic

### Expanded or collapsed, toggled three ways

#### Context

See `## Context`.

#### Business logic

The sidebar is either expanded or collapsed. It starts expanded unless the host asks for collapsed, and a host may own the state entirely and be told of every change. Three controls flip it: the "Toggle Sidebar" icon button the host places where it likes; a thin grab strip along the sidebar's outer edge, which shows a resize cursor pointing the way the sidebar will move and is skipped by Tab; and the keyboard shortcut Cmd+B on macOS or Ctrl+B elsewhere, which works anywhere on the page and replaces the browser's own use of that key. On a narrow screen the same three controls open and close the drawer instead.

### Three collapsing modes

#### Context

**User story**: the user folds the sidebar to give the workspace the full width, and still wants the navigation one click away.

#### Business logic

The sidebar is 16rem wide when expanded, sits on the left unless the host puts it on the right, and collapses in one of three ways chosen by the host. In off-canvas mode, the default, collapsing slides the whole sidebar out of view beyond the edge of the window and leaves no gap, and the grab strip stays reachable at the edge to bring it back. In icon mode, collapsing shrinks the sidebar to a 3rem strip: rows keep their icons only, and group labels, group actions, row actions, badges, nested sub-lists and the scrolling of the content are hidden. In the non-collapsible mode the sidebar is a plain fixed-width column that ignores the state. The sidebar also comes in three looks: flush with a border on its inner edge, floating as a bordered rounded panel, or inset, where the main content beside it is drawn as a rounded card.

### A drawer on a narrow screen

#### Context

**User story**: on a phone-width window there is no room for a permanent column; the user opens the navigation when needed and dismisses it to get back to the content.

#### Business logic

When the window is narrower than 768 pixels, a collapsible sidebar is not shown as a column at all: it becomes a drawer, 18rem wide, sliding in from the sidebar's side. The drawer is closed by default and its open state is separate from the desktop state, so folding the sidebar on a desktop does not change what a narrow window shows. The drawer's own close button is hidden; it closes through the same toggles or by dismissing it as any sheet (`sheet.tsx`). A non-collapsible sidebar stays a column even on a narrow screen. A row's tooltip is never shown in the drawer.

### The state is written to a cookie that nothing reads

#### Context

**Problem**: a sidebar the user folded should stay folded after a reload; the state is recorded for that purpose, but nothing restores it.

#### Business logic

Every change of the desktop state writes a cookie named `sidebar_state` holding `true` or `false`, for the whole site and for seven days. No part of the dashboard reads that cookie, so after a reload the sidebar starts from its default (or from whatever its host decides) regardless of what was recorded. The drawer state on a narrow screen is never recorded.

### Rows follow the collapsed state

#### Context

See `## Context`.

#### Business logic

A row is a button or link that fills the sidebar's width; the host can mark it active, which highlights it and makes its text medium weight, and pick one of three heights: small, default or large. A row that carries a tooltip shows it to its right only while the sidebar is collapsed to icons on a desktop-width screen, because that is when its label is hidden; expanded or in the drawer, the tooltip is suppressed. A row may carry a small action button at its right end, which the host can make hover-only: on a desktop-width screen it appears only while the row is hovered or focused, and on a narrow screen it is always visible so touch can reach it. A row may show a badge, a small number at its right end, and may unfold a nested sub-list of smaller rows with its own left border; badges, actions and sub-lists all hide when the sidebar is collapsed to icons. A disabled row is faded and ignores the pointer. While a list is loading, placeholder rows stand in for it, each with an optional icon block and a text block whose width is a steady value between 50% and 89% of the row, so the placeholder looks like text of varying length and does not flicker between renders.
