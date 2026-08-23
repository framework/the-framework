The single Notifications bell in the sidebar's utility footer, and the menu behind it. It makes the notification model legible by separating the two questions it used to blur: where a notification goes (Browser, Discord) and what the user wants to be notified about (Human Queue, New activity).

## Business logic — TL;DR

- **Two groups, one model** - "Deliver to" lists the delivery methods; "Notify me about" lists the categories. Every entry is a toggle stored in the user's preferences.
- **The bell reflects reality, not intent** - it lights up (filled bell plus a dot) only when a method can actually deliver: Browser counts only once the browser has granted permission, Discord only once a webhook is configured. Otherwise it shows a crossed-out bell.
- **Permission is asked at the moment of consent** - switching Browser on is what prompts the browser for notification permission; a browser that has blocked notifications shows the toggle disabled and says so.
- **Both categories are optional** - "Human Queue" (an agent awaiting the user, or a pull request to review) defaults on as the baseline, but is a real toggle like any other; "New activity" (an agent started or finished) is the second category.

## Business logic

### The bell tells the truth about delivery

#### User story

The user wants one glance to answer "will The Framework actually reach me?" — not "did I once click a toggle".

#### Business logic

A delivery method counts as active only when it can deliver. Browser is active when the toggle is on and the browser has granted permission. Discord is active when the toggle is on and the daemon has a Discord webhook configured. The bell is filled and dotted when at least one method is active, and crossed out otherwise.

Whether a webhook exists is read from the daemon and shared with the settings page, so configuring the credential there settles the bell here too. Until that first read lands the setup is assumed capable, so a correctly configured dashboard does not flicker to "off" on load.

#### Rationale

A Discord toggle switched on without a webhook configured used to light the bell for a channel that delivered nothing.

### Each toggle explains itself

#### User story

The user opens the menu and should not have to guess what a method reaches them through or why it is unavailable.

#### Business logic

Every toggle carries a one-line description under its name. Browser says whether notifications are blocked in browser settings, whether the user still needs to allow them, or that it delivers desktop notifications while the dashboard is open. Discord either says it reaches the user with no dashboard open, or that it is not configured and points at Settings for the webhook. Human Queue and New activity each name the events they cover. A browser that does not support notifications at all simply omits the Browser method.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
