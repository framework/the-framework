Holds the dashboard's building blocks: the buttons, fields, cards, pills, menus, dialogs, tooltips, the sidebar shell and the scrolling boxes that every page composes, drawn from the dashboard's own theme so that light and dark canvases read the same. Most carry no rule beyond how they look and respond; the ones that do are the sidebar (folding, the narrow-screen drawer, its keyboard shortcut), the confirm dialog for an action that cannot be taken back, the copy button, the scrolling box and the message feed view that follows an agent [1]'s event stream [2].

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[3] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.

## Business logic — TL;DR

- **The sidebar shell** (`sidebar.tsx`) - a side column expanded or collapsed by its "Toggle Sidebar" button, a grab strip on its edge or Cmd/Ctrl+B, shown as a drawer on a screen narrower than 768 pixels, its state written to a cookie that nothing reads back; the dashboard's one sidebar uses the non-collapsible form, so it is a fixed column today.
- **The edge drawer** (`sheet.tsx`) - a modal panel sliding in along the window's left or right edge, closed by Escape or a click on its backdrop; the sidebar's narrow-screen presentation.
- **Page surfaces** (`card.tsx`, `separator.tsx`, `skeleton.tsx`) - the bordered panel with an optional title, the thin divider, and the pulsing placeholder block that stands in for content still loading.
- **Controls** (`button.tsx`, `input.tsx`, `checkbox.tsx`, `slider.tsx`, `badge.tsx`) - the button in four emphasis levels and five sizes, the single-line text field, the themed checkbox, the two-thumb range slider for whole-number bounds, and the small pill for an event's kind or a status; a disabled control is faded and ignores the pointer.
- **Menus and floating panels** (`dropdown-menu.tsx`, `option-label.tsx`, `popover.tsx`, `tooltip.tsx`) - the dropdown menu that opens under a trigger kept lit while open, scrolls within the room it has, keeps itself open when a check item is toggled and opens submenus to the right; the two-line item label the menus share; the popover for content a menu cannot hold; and the tooltip that opens instantly and always paints above an open menu.
- **A small form in a modal box** (`dialog.tsx`) - the centered titled box for a form such as adding a device, dismissed by Escape, a click on the backdrop or its "Close" cross.
- **Confirming an action that cannot be taken back** (`confirm-dialog.tsx`) - a modal that ignores clicks outside it, cannot be closed while the confirmed action runs, stays open showing the failure when the action fails, and closes only on success, before the host continues.
- **Copying to the clipboard** (`copy-button.tsx`) - a button beside a branch name, session id or URL that copies it and flashes a check with "Copied" for 1.5 seconds; nothing changes when the clipboard is unavailable.
- **The scrolling box** (`scroll-area.tsx`, `scroll-area.test.tsx`) - a vertical scroll region with its own thin bar, present only while the content overflows, scrollable from the keyboard without a focus ring; the host caps the region's height when its box has none.
- **The message feed view** (`message-scroller.tsx`, `message-scroller.test.tsx`) - the view behind an agent [1]'s event stream [2] that follows the newest message until the user scrolls, offers "Jump to latest" only while something newer lies below, pulls the view to the start of a new turn [3], and keeps the rows in sight steady when older rows are added above.
