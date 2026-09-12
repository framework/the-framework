Provides the confirm-before-you-act dialog for an action that cannot be taken back: a modal box stating the consequence plainly, with "Cancel" and a confirm button, that runs the action when confirmed, stays open showing the error when the action fails, and closes only once the action has succeeded. The dashboard uses it for deleting an agent [1] (`AgentActionsMenu.tsx`).

## Context

**User story**: the user asks to delete an agent [1] and its work; the dashboard asks once, in plain words, what will be lost, and only a deliberate "Delete" throws it away. A stray click past the edge of the box, or a request that failed halfway, must never count as that confirmation.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.

## Business logic — TL;DR

- **A deliberate confirmation** - the dialog holds keyboard focus, ignores clicks outside it, and closes only through "Cancel", Escape or a successful confirm.
- **Opened by its own trigger or by the host** - the host either renders the control that opens the dialog or opens and closes it itself, as a menu item must.
- **The confirm button is red by default** - the confirm button carries the host's label in the destructive style unless the host asks for the neutral one; "Cancel" always sits beside it.
- **Nothing closes it while the action runs** - once confirmed, both buttons are disabled, the confirm button reads the busy label, and no keystroke or click closes the dialog until the action ends.
- **A failure keeps the dialog open with its error** - a thrown error or a refused result shows its message in the dialog, or "Something went wrong." when it has none, and the user may retry or cancel; reopening clears the message.
- **Success closes first, then the host continues** - on success the dialog closes and only then does the host's follow-up run, so the host may navigate away safely.

## Business logic

### A deliberate confirmation

#### Context

See `## Context`.

#### Business logic

The dialog is modal: a darkened, slightly blurred backdrop covers the page, keyboard focus stays inside the box, and a click on the backdrop does nothing. While idle, the dialog closes through "Cancel" or the Escape key. The box is centered, at most 26rem wide and never wider than the window minus a margin.

### Opened by its own trigger or by the host

#### Context

**Problem**: a menu closes as soon as its item is clicked, so a menu item cannot also be the control that keeps the dialog open; the host must be able to open the dialog itself.

#### Business logic

The host either renders the control that opens the dialog, such as an icon button, or holds the open state itself and opens the dialog from wherever it likes, being told of every close.

### The confirm button is red by default

#### Context

See `## Context`.

#### Business logic

The box shows the host's title, the consequence as the body text, and two buttons at the bottom right: "Cancel" in the outlined style and the confirm button carrying the host's label. The confirm button is in the destructive style unless the host asks for the default one.

### Nothing closes it while the action runs

#### Context

**Problem**: a dialog that closed on Escape or a second click while the request was still in flight would leave the user unsure whether the action happened.

#### Business logic

Once confirmed, the action runs; while it runs both buttons are disabled, the confirm button reads the busy label ("Working…" unless the host gives another) with a progress cursor, and every attempt to close the dialog is ignored until the action ends.

### A failure keeps the dialog open with its error

#### Context

See `## Context`.

#### Business logic

An action fails by throwing or by answering with a refused result; either way the dialog stays open and shows the failure's message in red under the body, or the host's fallback text, "Something went wrong." by default, when the failure carries no message. The user may confirm again or cancel. When the dialog is opened again later, any earlier message is cleared. An action that succeeds with nothing to report closes the dialog like any other success: only a refusal or a throw keeps it open.

### Success closes first, then the host continues

#### Context

**Problem**: the host of a delete typically leaves the page of the thing deleted; tearing the dialog down while it is still closing would break the close.

#### Business logic

When the action succeeds, the dialog closes, and only after the close has been requested does the host's follow-up run, so the host may navigate away in it.
