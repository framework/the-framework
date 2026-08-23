The dashboard's outermost shell: it applies the user's colour theme to the whole app and catches any crash inside it.

## Business logic — TL;DR

- **Three theme choices** - the dashboard follows the operating system by default, or is pinned to light or dark.
- **The operating system is followed only while chosen** - on the system setting the dashboard switches live when the OS switches; light and dark are fixed.
- **A crash lands on the app's own background** - the error boundary sits inside the themed shell, so a caught crash shows its recoverable card rather than a blank white browser page.

## Business logic

### Three theme choices

#### User story

The user picks whether the dashboard is light, dark, or follows their machine.

#### Business logic

The theme comes from the user's preferences and is one of system, light or dark. Until the preferences have arrived from the daemon the theme is treated as system, so a user whose machine is dark gets a dark first paint instead of a white flash.

### The operating system is followed only while chosen

#### User story

The user's machine switches to dark in the evening and the dashboard follows.

#### Business logic

On the system setting, the dashboard reacts to the operating system changing its light/dark preference while the dashboard is open. Light and dark are fixed choices and ignore the operating system entirely.

### A crash lands on the app's own background

#### User story

Something in the dashboard crashes while the user is reading it.

#### Business logic

Everything dynamic — the live event feed, the polled panels, rendered markdown — renders inside an error boundary, which itself sits inside the themed shell. A caught crash therefore shows its recoverable card on the dashboard's own background instead of the browser's blank white page.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
