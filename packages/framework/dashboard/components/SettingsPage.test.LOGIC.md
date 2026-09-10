What the tests cover, on a page whose daemon reports no devices, no detected editors and no stored preferences:

- **No empty drop-down** - every drop-down the page renders has at least one choice, and the "Editor" row stays usable with "Auto-detect" as its only entry when the daemon detected no editor.
- **Which browser does the bridge's work** - with the bridge on, the browser is one exclusive choice between "A browser the daemon runs" and "Your own Chrome"; the stored preference selects the daemon's browser; the daemon's browser option carries its own status ("The bridge browser is off") while the token to paste belongs only to the other option; with the bridge off, no browser choice is shown.
