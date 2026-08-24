The "Add project" dialog: the user picks the repo's folder in the OS's own folder picker, confirms they trust it, and the daemon activates and registers it.

## Business logic — TL;DR

- **The system dialog is the form** - the OS folder picker opens together with the modal; there is no path to type. Dismissing the picker closes the modal too.
- **Trust gate before installing** - nothing is registered until the user confirms they trust the picked repo, warned in plain language about prompt injection.
- **Says what happened** - on success it reads "Project added" (or "Already added" for a repo that was one), then closes itself shortly after.

## Business logic

### The system dialog is the form

#### User story

The user has a repo on this machine that they want The Framework to work on, and expects to point at it the way they point at any folder — in the system dialog.

#### Business logic

Opening the dialog immediately asks the daemon to open the OS folder picker; the modal meanwhile says to choose the folder there. Picking a folder moves to the trust confirmation. Dismissing the system picker closes the modal — the user already said "not now". If the picker itself cannot open (for example on a platform where none is wired up), the reason is shown with the option to try again. Esc, Cancel, and clicking outside the modal close it without adding; keyboard focus stays inside the modal and returns to the control that opened it once it closes.

### Trust gate before installing

#### User story

Registering a repo lets agents read its files, so a repo the user does not trust is a prompt-injection risk.

#### Business logic

Before adding, the dialog shows the picked path back to the user and states that hidden instructions in an untrusted repo can hijack the agent, and that only trusted repos should be added. "I trust it, add it" hands the path to the daemon, which activates and registers the project; "Choose again" reopens the system picker instead. A failure to add is reported in place, on the trust step, so the user can choose differently or retry.

### Says what happened

#### User story

The user needs to know the click worked.

#### Business logic

On success the dialog reads "Project added" — or "Already added" when the repo was already a project, so a double-add explains itself rather than pretending something new happened. It closes itself a couple of seconds later, or immediately on Done.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
