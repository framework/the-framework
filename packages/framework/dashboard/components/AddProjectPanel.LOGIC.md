The "Add project" modal, opened from the "Projects" list and from the onboarding checklist: the daemon opens the operating system's own folder picker, since a browser page cannot learn an absolute path from a picker of its own, hands the chosen folder back, the user confirms they trust the repository, and only then does the daemon install and register it as a project. Nothing is registered before that confirmation.

## Context

**User story**: the user adds a repository by choosing its folder in the familiar system dialog instead of typing a path, reads a plain-language warning that an untrusted repository can hijack the agent [1], and sees whether the project was added, was already there, or why it could not be.

**Problem**: adding a project lets agents read its files, and hidden instructions in a repository can hijack an agent through prompt injection; the trust confirmation is the one step that never gets skipped.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.

## Business logic — TL;DR

- **Picking is the form** - the system folder dialog opens the moment the modal does; dismissing it closes the modal, and a dialog the daemon could not open reports why with a "Try again".
- **The trust confirmation** - the chosen path is shown back under "Do you trust this repository?" with the prompt-injection warning, and the project is added only on "I trust it, add it"; "Choose again" reopens the system dialog.
- **Success and failure** - "Project added" or "Already added", with a "Done" and an automatic close after 2.5 seconds; a refused add shows the daemon's reason and stays on the trust step.
- **It behaves like a dialog** - Escape closes it, Tab stays inside it, clicking outside closes it, and focus returns to the control that opened it.

## Business logic

### Picking is the form

#### Context

See `## Context`.

#### Business logic

As soon as the modal opens it asks the daemon to open the system folder dialog, and meanwhile reads "Add project" and "Choose the repository's folder in the system dialog…" with a "Cancel" button. Then:

- The user picked a folder: the modal moves to the trust confirmation with that path.
- The user dismissed the system dialog: the modal closes too, without adding anything; the user said "not now" once already.
- The daemon could not open a dialog, or could not be reached: the modal shows the reason in red under "Add project" (the daemon's own message, such as that the machine running The Framework has no desktop session and so no folder dialog can open there; or "Could not reach the daemon."), with "Cancel" and "Try again", which asks the daemon again.

### The trust confirmation

#### Context

See `## Context`.

#### Business logic

With a folder picked, the modal reads "Do you trust this repository?", shows the picked path, and warns: "Adding it lets the agent read its files. Hidden instructions in an untrusted repo can hijack the agent (prompt injection), so only add repos you trust." Two buttons: "Choose again" reopens the system folder dialog and, if a folder is picked, replaces the path; "I trust it, add it", focused by default, asks the daemon to install and register the project, reading "Adding…" while it does. Both are disabled while the add is in flight. The daemon is never asked to add a project the user has not confirmed.

### Success and failure

#### Context

**User story**: the user knows at once whether the project was added, and, when the daemon refuses, why.

#### Business logic

- Success: the modal reads "Project added", or "Already added" when the repository was already a project, tells the caller so the project list is refreshed, and offers a focused "Done" that closes it; left alone, it closes by itself 2.5 seconds later.
- Failure: the trust step stays, with the daemon's reason in red (for instance that the path does not exist or is not a directory), or "Failed to add the project." when the daemon gave none, so the user can retry or choose another folder.

### It behaves like a dialog

#### Context

**Problem**: a modal that lets keyboard focus escape into the page behind it, or that leaves focus nowhere when it closes, is not the dialog it claims to be.

#### Business logic

Escape closes the modal. Tab and Shift+Tab cycle through the modal's own controls and never leave it. Clicking the dimmed area outside the modal closes it, the same as dismissing the menu it was opened from. When the modal closes, focus returns to the control that had it when the modal opened.
