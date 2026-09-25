The "Notifications" bell in the sidebar's footer: one menu that writes the notification preferences [3] — whether notifications are delivered in the browser ("Deliver to": "Browser") and what they are about ("Notify me about": "Human Queue", "New activity") — and whose icon lights only when browser delivery can actually reach the user.

## Context

**User story**: the user wants to be told on the desktop, while the dashboard is open, when an agent [2] is waiting on them or a pull request needs review, and to see at a glance whether that is currently switched on and able to deliver.

**Business logic story**: a notification is shown only when browser delivery and its category are both on and the browser has granted its permission. The defaults are: "Browser" on, "Human Queue" on, "New activity" off. What a browser notification says and where a click on it goes is the rule of `lib/use-notifications.ts`.

## Glossary

[1] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[3] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).

## Business logic — TL;DR

- **The bell lights only when delivery is real** - a ringing bell with a dot and the tooltip "Notifications on" when "Browser" is on with permission granted; otherwise a crossed-out bell and the tooltip "Notifications".
- **"Deliver to"** - "Browser", shown only in browsers that support notifications; blocked when the permission is denied; turning it on asks for the permission.
- **"Notify me about"** - "Human Queue" (interventions [1], on by default and a real toggle) and "New activity" (an agent [2] started or finished, off by default).

## Business logic

### The bell lights only when delivery is real

#### Context

**Problem**: a toggle switched on while the browser has not granted its permission would light the bell for notifications nobody will receive.

#### Business logic

The button is named "Notifications". It shows a ringing bell in the foreground color with a small dot, and the tooltip "Notifications on", when "Browser" is on and the browser's permission is granted. Otherwise the button shows a crossed-out bell in the muted color and the tooltip "Notifications".

### "Deliver to"

#### Context

See `## Context`.

#### Business logic

The "Deliver to" group, and the separator under it, appear only when the browser supports notifications; otherwise the menu holds only "Notify me about". "Browser" reflects the browser delivery preference [3] (on by default). Its hint is "Blocked in your browser settings" when the permission is denied, in which case the toggle is disabled; "Click to allow browser notifications" when delivery is on but the permission is still undecided; otherwise "Desktop notifications while the dashboard is open". Turning it on writes the preference and, when the permission is undecided, asks the browser for it at that moment, since the request has to ride a click.

### "Notify me about"

#### Context

See `## Context`.

#### Business logic

- "Human Queue" ("An agent awaiting you, or a PR to review"): the interventions [1] category, on by default and a real toggle that can be turned off like any other; there is no "Always on" row.
- "New activity" ("An agent started or finished"): the activity category, off by default.

Each toggle writes its preference [3] at once, and the menu stays open so several can be flipped in one visit.
