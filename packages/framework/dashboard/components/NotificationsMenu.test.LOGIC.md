What the tests cover:

- **The menu's shape** - a "Deliver to" group with "Browser" and "Discord", and a "Notify me about" group with "Human Queue" and "New activity", both real toggles; no static "Always on" row.
- **Writing through** - toggling "Discord" and "New activity" writes each preference on; toggling "Human Queue", on by default, writes it off.
- **Enabling the browser asks for permission** - turning "Browser" on writes the preference and, while the permission is undecided, asks the browser for it.
- **When the bell lights** - the tooltip reads "Notifications on" while a granted method is on and "Notifications" when no method is effectively on.
- **A blocked permission** - a denied browser permission shows "Blocked in your browser settings" on the "Browser" row.
- **Discord needs its webhook** - with "Discord" on but no webhook the bell stays off and the row says "Not configured — add a webhook in Settings"; with the webhook in place the bell reads "Notifications on".
