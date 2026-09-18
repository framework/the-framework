What the tests cover, through the same RPCs the dashboard calls, against a daemon on throwaway state:

- **Adding a project** - registering a repository installs The Framework in it (the `.the-framework/.gitignore` that install writes and commits is there), lists it in the Projects sidebar as activated with its path, and answers the project header's reads: the current branch, an empty docs rail, an empty agent history; adding the same repository again is reported as already activated and does not duplicate it; a path that is not a repository is refused with a reason, not a crash.
- **Unknown projects degrade quietly** - reads for a project id nobody registered are empty (no agents, no git status), and a start for it is refused.
- **Settings read back** - the picks a Start hands to the project's start hook (the driver, the model), patched from the Settings page, read back; a driver nobody can pick is dropped rather than stored.
- **The usage panel** - with no quota reading the panel is told why it is unavailable, never shown an empty bar that reads as unused; with a reading, the windows and the time they were read pass through as the daemon reported them.
