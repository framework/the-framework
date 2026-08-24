The system folder picker behind the dashboard's "Add project": the daemon opens the OS's own choose-a-folder dialog and hands back the user's choice as an absolute path.

## Business logic — TL;DR

- **The dialog is the OS's** - on macOS the standard folder sheet opens, and the picked folder comes back as its absolute path, without the trailing slash the OS reports it with.
- **Dismissing is not an error** - a user who cancels the dialog gets a "nothing picked" answer, distinct from a dialog that failed to open, whose reason is reported.
- **Unwired platforms say so** - only macOS has a picker wired up so far; anywhere else the answer is that plainly, and nothing is attempted.

## Rationales

A browser page cannot learn the absolute path of anything the user picks in a dialog of its own — that is deliberate browser sandboxing — while the daemon runs on the machine the user is sitting at and can both show the dialog and read the answer.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
