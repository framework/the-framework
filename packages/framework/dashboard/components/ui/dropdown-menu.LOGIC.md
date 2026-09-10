Provides the dashboard's dropdown menu, the one behind the presets, agent/model, options gear, Context and notifications buttons: a menu that opens below its trigger, keeps the trigger lit while open, scrolls within the room it has, and offers plain items, check items, labeled groups, separators and submenus that open to the right.

## Business logic — TL;DR

- **Opens below its trigger, which stays lit** - the menu opens just under its trigger, aligned with the trigger's left edge unless the host centers or right-aligns it, and every trigger shows the same highlighted state for as long as its menu is open.
- **A long menu scrolls inside the room it has** - the menu is capped at the height available around the trigger and scrolls its items with the dashboard's own thin scrollbar rather than the operating system's.
- **Items highlight, disabled items are inert** - an item lights up under the pointer or keyboard focus; a disabled item is faded and ignores the pointer.
- **Check items keep the menu open** - a check item shows a check mark while on, and toggling it leaves the menu open so several options can be flipped in one pass.
- **Submenus open to the right** - an item that opens a submenu shows a chevron at its end, stays lit while its submenu is open, and the submenu opens to its right, top-aligned, with the same scrolling body.
