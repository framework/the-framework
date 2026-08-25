The system folder picker behind the dashboard's "Add project": the daemon opens the OS's own choose-a-folder dialog and hands back the user's choice as an absolute path.

## Business logic — TL;DR

- **The dialog is the OS's** - macOS, Linux and Windows each get their own desktop's standard folder dialog, and the picked folder comes back as its absolute path, without the trailing slash macOS reports it with.
- **Dismissing is not an error** - a user who cancels the dialog gets a "nothing picked" answer, distinct from a dialog that failed to open, whose reason is reported.
- **A dialog that cannot open says why** - a machine with no desktop session, a Linux machine without either dialog helper installed, and a platform with no dialog wired up each report that reason instead of attempting anything.

## Business logic

### The dialog is the OS's

#### User story

The user has a repo on this machine that they want The Framework to work on, and expects to point at it the way they point at any folder — in the dialog their own desktop uses.

#### Business logic

Each platform opens the folder dialog its desktop ships with: the standard folder sheet on macOS, the desktop's dialog helper on Linux, and the folder browser that comes with Windows. Linux has two such helpers in circulation — the GTK one used by GNOME-style desktops and the KDE one — so the GTK helper is asked first and the KDE one is used when it is not installed. Both Linux dialogs open in the user's home directory, since a repo is nearly always kept there.

The answer is the picked folder's absolute path. macOS reports it with a trailing slash, which is dropped, because the project registry stores paths without one.

### Dismissing is not an error

#### User story

A user who opens the dialog and changes their mind has said "not now", which is an answer, not a fault.

#### Business logic

A cancelled dialog comes back as "nothing picked", which the dashboard treats as closing the add-project flow rather than as something to report or retry. Each platform's dialog signals a cancellation its own way, and each is recognised: macOS reports it as AppleScript's "user cancelled", both Linux helpers as their documented cancel exit, and the Windows dialog through an outcome the script reserves for it, so that PowerShell failing on its own is still read as a failure.

### A dialog that cannot open says why

#### User story

When no dialog appears, the user needs to know what would make one appear, rather than watching the dashboard wait on nothing.

#### Business logic

Three situations are answered with their reason and nothing is spawned or retried:

- The machine running The Framework has no desktop session — a daemon started over SSH or inside a container has no screen to draw a dialog on. This is checked before asking for a dialog on Linux.
- Neither Linux dialog helper is installed, in which case the answer names both, so the user knows what to install.
- The platform has no dialog wired up at all, in which case the answer names that platform.

Any other failure reports whatever the dialog itself said went wrong.

## Rationales

A browser page cannot learn the absolute path of anything the user picks in a dialog of its own — that is deliberate browser sandboxing — while the daemon runs on the machine the user is sitting at and can both show the dialog and read the answer.

The dialogs are the desktop programs already installed on the machine, driven as commands, rather than a library: the one Node package for this is unmaintained and ships prebuilt binaries, and each platform's dialog is a single command away.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
