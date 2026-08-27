The bridge browser: a Chrome for Testing the daemon launches and owns, with the Claude web bridge extension installed, signed in to claude.ai once by the user and kept minimized — so a web run can be created, and a cloud session's parked question noticed, without the user's own Chrome being open.

## User story

- The user starts web runs from a daemon on a machine nobody sits at, or closes their laptop's Chrome, and still expects cloud sessions to be created and their questions to reach the dashboard.
- The user signs in to claude.ai once, in a window the dashboard brings up for that purpose, and never has to see that window again.

## Glossary

- **bridge browser** - the Chrome for Testing the daemon runs for the bridge, distinct from the agent's browser (the throwaway Chrome an agent gets for its browser tools) and from the user's own Chrome.
- **Driver tab** - the one pinned claude.ai tab the extension drives through every cloud session (see the extension's specification).
- **profile** - the browser's persistent state on disk: the claude.ai sign-in, the installed extension and its settings. Kept across daemon restarts.

## Business logic — TL;DR

- **One browser, owned by the daemon** - launched when the bridge browser preference is on and the dashboard is listening; closed when the daemon stops or the preference is switched off; never more than one.
- **Headed, minimized, Chrome for Testing** - a headless browser is rejected by claude.ai's bot gate, a minimized headed one passes; branded Chrome refuses an extension handed to it from outside, Chrome for Testing takes one over its debugging protocol.
- **The browser is downloaded once** - the current stable Chrome for Testing is fetched into the bridge browser's directory the first time, with the download's progress reported to the dashboard.
- **The extension is installed and set up without a person** - installed over the debugging protocol, developer mode switched on so the extension's self-reload keeps working, the daemon's address and bridge token handed to it, and the pinned Driver tab opened on claude.ai's session list.
- **The one-time sign-in is the user's** - the dashboard brings the window up on request; the user signs in; the window is minimized again.
- **A leftover browser is stopped first** - a browser a dead daemon left holding the profile is terminated before the new one starts.
- **A browser that exits on its own is reported, not relaunched** - the reason is shown, and the dashboard offers a restart.
- **A checkout feature** - the extension's files are the checkout's; without them the launch says so.

## Business logic

### One browser, owned by the daemon

#### User story

See `## User story`: cloud sessions are served whether or not the user's Chrome is open.

#### Business logic

The daemon keeps at most one bridge browser. It launches it when the bridge browser preference is on and the dashboard is listening — the extension must be told the daemon's address — and only while the browser bridge itself is on, since without the bridge token there is nothing to hand the extension; the bridge token is read when the daemon starts, so a launch asked for without one fails saying what to do — restart the dashboard when the bridge was switched on after it started, turn the bridge on first when it is off. A launch that fails before it begins is reported exactly like one that fails on the way: as stopped, with the reason, never as an error that escapes the daemon. Switching the preference on launches the browser at once; switching it off closes it; stopping the daemon closes it. Asking for a launch while one is under way or a browser is running does nothing more. A stop that lands while a launch is under way closes the browser that launch then hands over, so a browser is never left running unowned.

The dashboard reads where the browser stands: off; starting, with the step it is on; running, whether its window is shown, and whether its claude.ai tab is on the sign-in page (or the sign-out step that leads there) — read from the browser itself, not from the bridge, whose last report may be the user's own Chrome's; or stopped, with the reason. It can ask for the window to be shown or hidden, or for a restart (a stop, then a launch).

### Headed, minimized, Chrome for Testing

#### User story

The user wants the browser to exist and be signed in, and otherwise never to see it.

#### Business logic

The browser is launched with a window, never headless: claude.ai's bot gate never clears a headless browser and clears a headed one at once, whether its window is visible or not. Right after set-up every window is minimized. Minimized rather than moved off the screen: the desktop keeps part of any off-screen window on the screen, and a minimized one passes the gate.

The binary is Chrome for Testing, kept in the bridge browser's directory, never the Chrome installed on the machine: branded Chrome ignores an unpacked extension handed to it from the command line, and an extension loaded from the command line is disabled the first time it is reloaded. The launch opens the browser's debugging port on this machine only, with the flag that lets an extension be installed over that port, on the bridge browser's own persistent profile. The browser is told to keep its cookie-encryption key to itself rather than in the operating system's keychain: with the keychain, macOS asks for the user's login password at every launch, and an unattended browser can never answer that. The sign-in stored in the profile is guarded by the profile directory's permissions instead — the choice browser-automation tools make.

#### Rationale

Working around the bot gate — making a headless browser look headed — was considered on the spike and rejected: it is an arms race against claude.ai and a usage-policy exposure. A headed browser nobody looks at is the same automation in a window that exists.

### The browser is downloaded once

#### User story

The user switches the bridge browser on and waits, rather than installing a browser by hand.

#### Business logic

When the bridge browser's directory holds no Chrome for Testing, the current stable build for this platform is looked up and downloaded into it (about 150 MB), and each step — the lookup, the download's percentage — is reported as the launch's current step. Once one is there, the newest is used and nothing is downloaded. An unsupported platform fails the launch by name.

### The extension is installed and set up without a person

#### User story

See `## User story`: the daemon's browser must reach the bridge exactly as the user's own Chrome does after the manual set-up, with nobody performing that set-up.

#### Business logic

Once the browser answers on its debugging port, in order:

1. The extension is installed from its directory over the debugging protocol, which answers with the extension's id. That install grants the extension its declared site access, so the manual grant the extension's set-up guide asks for is not needed.
2. Developer mode is switched on: Chrome's extensions page is opened in the background, its developer-mode switch is flipped if it is off, and the page is closed. With the mode off, Chrome disables an unpacked extension on reload instead of reloading it, and the extension reloads itself whenever its files change; the profile remembers the setting.
3. The extension's service worker is handed what its options page would have been given: the daemon's address, the bridge token, and the Driver tab switched on. In the same step the pinned Driver tab is opened on claude.ai's session list and the blank page the browser started on is closed — opened here because the extension opens no Driver tab while the daemon lists no cloud session, and the user signs in on that tab before any session exists.
4. Every window is minimized.

A step that fails closes the browser again and fails the launch naming the step, so a half-set-up browser is never left running. Each step waits a bounded time for what it needs — the extensions page, the worker — before giving up.

From then on the extension does in this browser what it does in the user's own: its Driver cycle runs, and the daemon learns about it through the bridge's own routes.

### The one-time sign-in is the user's

#### User story

The user switches the bridge browser on for the first time and has to sign in to claude.ai in it.

#### Business logic

On request the daemon restores every window, brings the claude.ai tab to the front, and brings the browser application to the front (on macOS by activating its application bundle). The user signs in there. On request the windows are minimized again. The profile keeps the sign-in, so it outlives daemon restarts and relaunches; it has to be repeated only when claude.ai's own session expires.

### A leftover browser is stopped first

#### User story

The daemon crashed, or was killed the hard way; its browser is still running. The user starts the daemon again.

#### Business logic

Chrome leaves a lock in the profile naming the process holding it. Before launching, a process named by that lock that is still alive — and is not this daemon — is asked to terminate, given a few seconds, and killed if it stays. The launch then proceeds and reports that a leftover browser was stopped. A lock naming a process that is gone is ignored. Only the framework's own profile is ever involved, so whatever holds it is the framework's own leftover.

#### Rationale

A second Chrome pointed at a profile that is held hands its command line to the holder and exits at once; the launch would then wait for a port that never opens.

### A browser that exits on its own is reported, not relaunched

#### User story

The user quits the bridge browser, or it crashes.

#### Business logic

When the browser process ends without the daemon asking, the bridge browser is reported as stopped with the reason (the signal or exit code), and it is not relaunched: quitting it was an act, and the dashboard offers a restart. An exit the daemon caused by closing the browser is not reported. Closing asks the browser to close itself first, so the profile is written out, and kills the process only when it has not left after a short grace.

### A checkout feature

#### User story

The user runs the daemon from the published package rather than from a checkout of the repository.

#### Business logic

The extension's files are the checkout's `packages/chrome-extension`, next to this package. Without them the launch fails saying where they were expected. The bridge browser's own directory is beside the registry file — `$XDG_CONFIG_HOME/the-framework-browser` when that variable is set, else `~/.the-framework-browser` — so the isolation a test applies to the registry covers the browser too.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
