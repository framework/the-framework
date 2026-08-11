The Serve control: one click serves the project's built app and hands you the live URL, closing the "let me see what it produced" loop without leaving the dashboard.

## TLDR

- While serving, the control becomes Open-in-browser plus Stop; the serving state lives in the daemon, so a reload finds a preview that is already running.
- A repo with several servable apps gets a split button: the primary serves the last pick (the daemon remembers), a caret picks among the apps.
- On a session's bar it serves that session's own working copy, not the project's checkout — what you look at is what that session wrote, several sessions can serve at once, and the project home keeps serving the main checkout.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
