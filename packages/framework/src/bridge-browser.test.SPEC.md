What the bridge browser's tests cover. Every launch runs against a fake Chrome (recorded debugging-protocol calls, a scripted target list, scripted answers to evaluations) and a fake process, so nothing here starts a browser.

- **Where it lives** - the bridge browser's directory sits beside the registry file, under `$XDG_CONFIG_HOME` when set and dotted under the home directory otherwise.
- **The launch flags** - headed (no headless flag), the bridge browser's own profile, the debugging port, the flag that lets an extension be installed over that port, and no command-line extension install.
- **The extension's files** - resolved to the checkout's `chrome-extension` directory.
- **The profile lock** - names the process holding it, nothing when there is no lock, and nothing for a lock that names no process.
- **The application bundle** - found from a macOS binary path, absent for any other path.
- **The seed** - the daemon's address, the token (quoted so it cannot break out of the expression), the Driver tab switched on, and the pinned claude.ai session-list tab.
- **The launch sequence** - a persistent profile under the bridge browser's directory; the install from the extension's directory; developer mode flipped on the extensions page after the install, and that page closed; the token handed to the extension's worker; every window minimized last; the steps reported in order. Show restores the window and activates the application; hide minimizes again.
- **A leftover browser** - the process holding the profile is terminated before the launch; a lock whose owner is gone is only a leftover file.
- **A browser that never listens** - is killed, and the launch fails naming the port.
- **A failed set-up step** - the browser is asked to close and killed when it does not, and the launch fails naming the step.
- **A worker that refuses the token** - fails the launch quoting the worker's answer.
- **An exit on its own** - reported once with the signal; an exit the daemon's own close caused is not reported, and a browser already gone is not killed again.
- **The owner** - reports the launch's step, then running (and whether shown), then stopped with the reason when the browser exits; show and hide do nothing once it is gone. A failed launch is stopped with the reason and a later start tries again — including a launch that fails before it begins, when the launcher throws outright. A stop during a launch closes the browser the launch hands over. Repeated starts are one launch; restart is a stop then a start.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
