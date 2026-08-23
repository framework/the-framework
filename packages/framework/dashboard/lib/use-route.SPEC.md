The dashboard's current location as state: which view the user is on is read from the browser's address bar, and moving elsewhere writes it back there. That is what makes Back and Forward work for free, and what makes any view a link the user can paste, reload, or open twice.

Everything in the dashboard that follows the location is woken both by the user pressing Back or Forward and by the dashboard's own navigations. Navigating to where the user already is adds nothing to the history, so the Back button is never spent on a no-op. A navigation can also replace the current history entry instead of adding one — used for a correction rather than a step, such as the address bar catching up with a just-started agent's identity, which the user should not be able to walk back into. Before the browser takes over, the location reads as the dashboard's root.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
