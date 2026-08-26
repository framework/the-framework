The settings line for the bridge browser: where the daemon's own browser stands, and the one thing only a person can do for it — sign in to claude.ai, once, in its window.

## User story

- The user switches the bridge browser on and wants to know what is happening while its first launch downloads a browser.
- The user has to sign in to claude.ai in the bridge browser once, and needs the window brought up for that.
- The user quit the bridge browser, or it crashed, and wants it back.

## Business logic — TL;DR

- **The line follows the daemon** - it is re-read every few seconds while the switch is on, and shows nothing while it is off.
- **A launch names its step** - so a minutes-long download does not read as a hang.
- **A running browser can be shown and hidden** - shown for the sign-in, hidden again after; the button offered is the one that applies.
- **The sign-in is asked for by name** - when the browser's Driver tab reports claude.ai's sign-in page, the line says to show the window and sign in once.
- **A stopped browser says why, and offers a restart** - the reason the daemon recorded, and a Restart button.

## Business logic

### The line follows the daemon

#### User story

See `## User story`: everything about the bridge browser happens out of sight.

#### Business logic

While the bridge browser switch is on, the line reads the bridge browser's status from the daemon every few seconds. While the switch is off nothing is shown and nothing is read.

### A launch names its step

#### User story

The user switches the bridge browser on for the first time; a browser is being downloaded.

#### Business logic

While the daemon reports the browser as starting, the line says so and quotes the step the daemon is on — the lookup, the download and its percentage, the extension's install, the token hand-over.

### A running browser can be shown and hidden

#### User story

The user needs the window, then wants it gone.

#### Business logic

While the browser runs, the line says so and whether its window is shown or minimized. A minimized browser offers to show the window; a shown one offers to hide it. Either way a Restart is offered. Each button asks the daemon for that action.

### The sign-in is asked for by name

#### User story

The bridge browser is running but signed out, so nothing it does reaches a session.

#### Business logic

When the daemon reports the browser running and its claude.ai tab on the sign-in page, the line says so and to show the window, sign in once, then hide it again; the show button is worded for the sign-in. Once the tab is on any other page, the prompt is gone. The daemon reads that page from its own browser, so the user's own Chrome reporting to the bridge at the same time cannot mask it.

### A stopped browser says why, and offers a restart

#### User story

See `## User story`: the browser was quit, or could not start.

#### Business logic

When the daemon reports the browser as stopped, the line quotes the reason — the exit signal, or the launch step that failed — and offers a Restart, which asks the daemon to launch it again.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
