The "Add project" modal, opened from the "Projects" list and from the onboarding checklist: the daemon opens the operating system's own folder picker, since a browser page cannot learn an absolute path from a picker of its own, hands the chosen folder back, the user confirms they trust the repository and says where the agents' records go (kept on this machine unless they pick sharing them to the repository's remote), and only then does the daemon install and register it as a project. Nothing is registered before that confirmation. The onboarding checklist may hand the modal the folder the dashboard runs in: then there is nothing to pick.

## Context

**User story**: the user adds a repository by choosing its folder in the familiar system dialog instead of typing a path, reads a plain-language warning that an untrusted repository can hijack the agent [1], and sees whether the project was added, was already there, or why it could not be.

**Problem**: adding a project lets agents read its files, and hidden instructions in a repository can hijack an agent through prompt injection; the trust confirmation is the one step that never gets skipped.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.

## Business logic — TL;DR

- **Picking is the form** - the system folder dialog opens the moment the modal does; dismissing it closes the modal, and a dialog the daemon could not open reports why with a "Try again"; a modal handed a folder opens no system dialog and starts at the trust confirmation.
- **The trust confirmation** - the chosen path is shown back under "Do you trust this repository?" with the prompt-injection warning and, under it, what adding the project does to the folder (`AddProjectEffects.tsx`, the same text as on the onboarding checklist), and the project is added only on "I trust it, add it"; "Choose again" reopens the system dialog, and reads "Cancel", closing the modal, when the folder was handed in.
- **Where the agents' records go** - on the trust step, two choices: "Keep them on this machine", picked until the user picks the other, and "Share them to the repository's remote"; each says what it does before anything happens, and the pick travels with the add.
- **Success and failure** - "Project added" or "Already added", with a "Done" and an automatic close after 2.5 seconds; when sharing was picked and the repository has no remote, a line says the records stay on this machine and the close waits 6 seconds; a refused add shows the daemon's reason and stays on the trust step.
- **It behaves like a dialog** - Escape closes it, Tab stays inside it, clicking outside closes it, and focus returns to the control that opened it.

## Business logic

### Picking is the form

#### Context

See `## Context`.

#### Business logic

A modal handed a folder by its opener (the onboarding checklist's "Add <directory> as project…") never asks for the system folder dialog: it opens on the trust confirmation with that folder. Otherwise, as soon as the modal opens it asks the daemon to open the system folder dialog, and meanwhile reads "Add project" and "Choose the repository's folder in the system dialog…" with a "Cancel" button. Then:

- The user picked a folder: the modal moves to the trust confirmation with that path.
- The user dismissed the system dialog: the modal closes too, without adding anything; the user said "not now" once already.
- The daemon could not open a dialog, or could not be reached: the modal shows the reason in red under "Add project" (the daemon's own message, such as that the machine running OpenAgent has no desktop session and so no folder dialog can open there; or "Could not reach the daemon."), with "Cancel" and "Try again", which asks the daemon again.

### The trust confirmation

#### Context

See `## Context`.

#### Business logic

With a folder picked, the modal reads "Do you trust this repository?", shows the picked path, and warns: "Adding it lets the agent read its files. Hidden instructions in an untrusted repo can hijack the agent (prompt injection), so only add repos you trust." Under the warning, the same text as on the onboarding checklist says what adding the project does to the folder (`AddProjectEffects.tsx`). Two buttons: "Choose again" reopens the system folder dialog and, if a folder is picked, replaces the path (when the folder was handed in by the opener there is nothing to choose again, so the button reads "Cancel" and closes the modal without adding anything); "I trust it, add it", focused by default, asks the daemon to install and register the project, with the user's answer on the agents' records (next section), reading "Adding…" while it does. Both are disabled while the add is in flight. The daemon is never asked to add a project the user has not confirmed.

### Where the agents' records go

#### Context

**User story**: before a repository becomes a project, the user decides whether what they ask each agent [1] and what it answers stays on their machine or is pushed to the repository's remote, where everyone who can read the remote can read it.

**Problem**: the records live on a branch of the repository, `agent-data`, and a branch pushed without a question puts them on a remote the user may not own. Nothing is pushed unless the user said so here, or later in the project's menu (`AgentActionsMenu.tsx`).

#### Business logic

Between that text and the buttons, the trust step asks under "The agents' records (what you ask, what each agent answers)", as one choice of two:

- "Keep them on this machine", with "Nothing is pushed." under it. It is the one picked when the step opens.
- "Share them to the repository's remote", with "Pushes a branch agent-data to origin, and keeps pushing as agents work." under it.

Under the two: "You can change this later in the project's menu." The choice is disabled while the add is in flight, and "I trust it, add it" sends it with the path: a yes only when the user picked sharing. The same question is asked whether or not the repository has a remote; for one with none, the daemon keeps the records whatever the answer (`src/daemon-runtime.ts`) and the success step says so.

### Success and failure

#### Context

**User story**: the user knows at once whether the project was added, and, when the daemon refuses, why.

#### Business logic

- Success: the modal reads "Project added", or "Already added" when the repository was already a project, tells the caller so the project list is refreshed, and offers a focused "Done" that closes it; left alone, it closes by itself 2.5 seconds later. When the user picked sharing and the daemon answers that the repository has no remote, a grey line under the title reads "This repository has no remote, so the agents' records stay on this machine.", and the modal stays 6 seconds before closing by itself, so the line can be read.
- Failure: the trust step stays, with the daemon's reason in red (for instance that the path does not exist or is not a directory), or "Failed to add the project." when the daemon gave none, so the user can retry or choose another folder.

### It behaves like a dialog

#### Context

**Problem**: a modal that lets keyboard focus escape into the page behind it, or that leaves focus nowhere when it closes, is not the dialog it claims to be.

#### Business logic

Escape closes the modal. Tab and Shift+Tab cycle through the modal's own controls and never leave it. Clicking the dimmed area outside the modal closes it, the same as dismissing the menu it was opened from. When the modal closes, focus returns to the control that had it when the modal opened.
