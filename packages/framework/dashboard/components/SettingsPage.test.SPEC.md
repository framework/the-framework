What the tests cover: on a machine with no stored preferences, no saved devices and no editors detected, the Settings page renders its controls and none of its pickers is empty — an empty picker can be opened but not used, which reads as broken. In particular the Editor row, whose choices are the only ones assembled at run time, stays usable with nothing detected, offering auto-detect as a real choice rather than a placeholder.

- **Claude web (#1332)** - with the bridge on, which browser does the work is one radio choice — the daemon's browser preselected when the preference is on, carrying its status line, and no token panel under it; with the bridge off no choice is offered.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
