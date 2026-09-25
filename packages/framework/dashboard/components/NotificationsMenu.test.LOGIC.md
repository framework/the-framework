What the tests cover:

- **The menu's shape** - a "Deliver to" group with "Browser", and a "Notify me about" group with "Human Queue" and "New activity", both real toggles; no static "Always on" row.
- **Writing through** - toggling "New activity" writes it on; toggling "Human Queue", on by default, writes it off.
- **Enabling the browser asks for permission** - turning "Browser" on writes the preference and, while the permission is undecided, asks the browser for it.
- **When the bell lights** - the tooltip reads "Notifications on" while "Browser" is on and granted, "Notifications" when "Browser" is off, and "Notifications" while the permission is still undecided.
- **A blocked permission** - a denied browser permission shows "Blocked in your browser settings" on the "Browser" row.
- **No browser support** - in a browser without notifications the menu has no "Deliver to" group and still offers the categories.
