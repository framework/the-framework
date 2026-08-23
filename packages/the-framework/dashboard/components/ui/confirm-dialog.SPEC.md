The dashboard's confirmation step in front of an action that cannot be taken back — removing an agent, deleting a project. It states the action's title and, in plain words, its consequence, and offers Cancel plus one confirm button that is red by default.

## Business logic — TL;DR

- **The confirmation is deliberate** - a click outside the dialog does not dismiss it, and keyboard focus stays inside it, so a destructive action is never triggered by a stray click.
- **The dialog waits for the action, and reports its failure in place** - confirming runs the action while both buttons are disabled and the confirm button shows a busy label; the dialog cannot be closed while the action is in flight; a failure keeps the dialog open with the error message shown inside it, so nothing fails silently. Reopening the dialog clears a previous error.
- **Success closes first, then hands back** - the dialog closes on success and only afterwards notifies the caller, so a caller that navigates away from the just-deleted thing does not tear the dialog down mid-close.
- **Opened by its own control or by the caller** - it normally renders the control that opens it, but a caller can open it itself, which is how a confirmation gets opened from a menu entry (the menu closes on click and so cannot also be the control that opens the dialog).

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
