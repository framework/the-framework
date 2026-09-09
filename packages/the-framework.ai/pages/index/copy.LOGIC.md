Copies a command to the visitor's clipboard when a command chip or box is clicked and drives the "copy" / "copied!" confirmation, while staying out of the way of a visitor who is selecting the text instead. It serves the hero's "Try:" box and install chip (`Hero.tsx`) and the commands of the "Go to dashboard" page (`../go-to-dashboard/+Page.tsx`).

## Context

**User story**: the visitor clicks a command, sees "copied!", and pastes it into a terminal.

**Problem**: the same command text is both something to copy with a click and something a visitor may select with the mouse to copy by hand. A double-click selects a word and a triple-click a line; each would otherwise copy the whole command and flash "copied!" over the selection. Browsers also differ in what they allow: the clipboard may be unavailable or refused, yet the visitor must always be able to get the command one way or another.

## Business logic — TL;DR

- **A single click copies; selecting does not** - only the first click of a click sequence copies; the extra clicks of a double or triple click, and any click made while text is selected on the page, do nothing.
- **Clipboard with a fallback, never an error** - the text goes through the browser's clipboard API, or through a hidden text field and the legacy copy command when the API is missing or refuses; a copy that fails even then is silent and the confirmation still shows.
- **"copied!" for one and a half seconds** - the confirmation stays 1.5 seconds, or 2 seconds longer when the visitor is selecting text at that moment, so it never flips back mid-selection.

## Business logic

### A single click copies; selecting does not

#### Context

See `## Context`.

#### Business logic

A click copies only when it is the first click of a click sequence: the second click of a double-click and the third of a triple-click are ignored. A click is also ignored when any text is selected anywhere on the page at that moment, so a visitor selecting the command by hand is never interrupted by a copy.

### Clipboard with a fallback, never an error

#### Context

See `## Context`.

#### Business logic

The text is written with the browser's asynchronous clipboard API when the browser offers it. When the API is absent, or when it refuses (an insecure page, a denied permission), the text is placed in an invisible text field, selected, copied with the browser's legacy copy command, and the field is removed again. If even that fails, nothing is reported: the "copied!" confirmation shows regardless, and the visitor can still select and copy the command by hand. In that rare case the visitor sees "copied!" while the clipboard is unchanged.

### "copied!" for one and a half seconds

#### Context

See `## Context`.

#### Business logic

Once a copy is done, the chip's or box's badge switches from "copy" to "copied!" for 1.5 seconds. If, when that time is up, the visitor is selecting text on the page, the confirmation stays another 2 seconds before reverting, so it never changes under a selection in progress. The badge is only visible while the pointer hovers the command or while it reads "copied!" (the visibility rule lives in `styles.css`).
