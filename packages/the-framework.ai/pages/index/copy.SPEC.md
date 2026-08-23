The click-to-copy behavior shared by every copyable snippet on the website (install commands, prompts, code chips): one click puts the snippet's text on the clipboard and turns the snippet's label into "copied!" for 1.5 seconds.

## Business logic — TL;DR

- **Selecting text is never hijacked** - a click that is part of a double- or triple-click, or a click made while anything on the page is already selected, does not copy.
- **The badge waits out a selection** - if the visitor has text selected when the "copied!" badge is due to disappear, the badge stays 2 seconds longer instead of changing while they are still selecting.
- **Copying always reports success** - when the browser denies clipboard access, the text is copied by an off-screen fallback; if even that fails the badge still shows, since the visitor can always select the snippet by hand.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
