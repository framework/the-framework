The "Notifications" bell in the sidebar's footer: one menu that writes the notification preferences [3] — where notifications are delivered ("Deliver to": "Browser", "Discord") and what they are about ("Notify me about": "Human Queue", "New activity") — and whose icon lights only when some delivery method can actually reach the user.

## Context

**User story**: the user wants to be told when an agent [2] is waiting on them or a pull request needs review, on the desktop while the dashboard is open or on Discord when it is not, and to see at a glance whether that is currently switched on and able to deliver.

**Business logic story**: a notification is sent only when both its method and its category are on; the browser method additionally needs the browser's permission, and Discord additionally needs the webhook the daemon holds. The defaults are: "Browser" on, "Discord" off, "Human Queue" on, "New activity" off. What a browser notification says and where a click on it goes is the rule of `lib/use-notifications.ts`; the daemon's own Discord delivery follows the same preferences.

## Glossary

[1] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[4] Settings: the settings page.

## Business logic — TL;DR

- **The bell lights only when delivery is real** - a ringing bell with a dot and the tooltip "Notifications on" when "Browser" is on with permission granted, or "Discord" is on with a webhook in place; otherwise a crossed-out bell and the tooltip "Notifications".
- **"Deliver to"** - "Browser" (only in browsers that support notifications; blocked when the permission is denied; turning it on asks for the permission) and "Discord" (a preference, whose hint says when the webhook is missing).
- **"Notify me about"** - "Human Queue" (interventions [1], on by default and a real toggle) and "New activity" (an agent [2] started or finished, off by default).

## Business logic

### The bell lights only when delivery is real

#### Context

**Problem**: a toggle switched on for a channel that cannot deliver — Discord without a webhook, the browser without permission — would light the bell for notifications nobody will receive.

#### Business logic

The button is named "Notifications". It shows a ringing bell in the foreground color with a small dot, and the tooltip "Notifications on", when at least one method is effectively on: "Browser" on and the browser's permission granted, or "Discord" on and the daemon holding a Discord webhook. Until the daemon's channel capability has been read once, it counts as capable, so a properly configured setup does not flicker. Otherwise the button shows a crossed-out bell in the muted color and the tooltip "Notifications". The capability is one value shared with the Settings [4] rows and the onboarding card, so a webhook saved there settles the bell too.

### "Deliver to"

#### Context

See `## Context`.

#### Business logic

- "Browser" appears only when the browser supports notifications. It reflects the browser delivery preference [3] (on by default). Its hint is "Blocked in your browser settings" when the permission is denied, in which case the toggle is disabled; "Click to allow browser notifications" when delivery is on but the permission is still undecided; otherwise "Desktop notifications while the dashboard is open". Turning it on writes the preference and, when the permission is undecided, asks the browser for it at that moment, since the request has to ride a click.
- "Discord" reflects the Discord delivery preference (off by default); toggling it writes the preference. Its hint is "Reaches you with no dashboard open" while the daemon holds a webhook (or the capability is not known yet), and "Not configured — add a webhook in Settings" when it does not: the toggle is the preference, the webhook is the capability, added on the Settings [4] page.

### "Notify me about"

#### Context

See `## Context`.

#### Business logic

- "Human Queue" ("An agent awaiting you, or a PR to review"): the interventions [1] category, on by default and a real toggle that can be turned off like any other; there is no "Always on" row.
- "New activity" ("An agent started or finished"): the activity category, off by default.

Each toggle writes its preference [3] at once, and the menu stays open so several can be flipped in one visit.
