What the tests cover, for the daemon's bridge browser:

- **Where it lives** - under `$XDG_CONFIG_HOME/the-framework-browser` when that variable is set, else `~/.the-framework-browser`, beside the registry so a test's isolation covers it too.
- **The launch flags** - headed, since claude.ai's bot gate rejects a headless browser; on its own profile; with its debugging port open; with extension debugging enabled, which installing over the connection needs; without the OS keychain, so an unattended browser never pops a password dialog; and never with a command-line extension install, which Chrome disables on the first reload.
- **The extension files** - the extension is the checkout's `chrome-extension` package next to this one.
- **The profile lock** - the lock names the process holding it; no lock, or a lock that names no process, means nobody holds it.
- **The macOS application** - the application bundle around the binary is what gets activated; a bare binary has none.
- **What the extension is handed** - the daemon's address, the bridge token quoted so it cannot break out, automatic opening switched on, and the Driver tab opened pinned on `https://claude.ai/code`.
- **The launch sequence** - the extension is installed from its directory, developer mode is switched on afterwards on Chrome's extensions page, which is closed again, the extension's worker gets the token and the daemon's address, and the window ends minimized; the steps are reported in order ("starting Chrome for Testing", "installing the extension", "handing the extension the bridge token"); the daemon reads which page its claude.ai tab is on; showing restores the window and activates the application, hiding minimizes it again.
- **A stale browser on the profile** - a live process holding the profile is asked to terminate before the launch; a lock whose holder is gone is just a leftover file.
- **Failures** - a browser that never opens its debugging port is killed and the launch fails saying so; a setup step that fails asks the browser to close itself and kills it when it does not; a worker that does not take the token fails the launch by name.
- **Exits** - Chrome exiting on its own is reported once, with the signal; an exit caused by a close asked for is not reported, and a browser already gone is not killed again.
- **The owner's states** - off, then starting with the launch's current step, then running; showing marks it visible; a browser that exits on its own is stopped with the reason rather than off, and nothing is shown once it is gone.
- **Failed launches** - a launch that fails is stopped with the reason and logged as "could not start", and a second start tries again; a launcher that throws before launching is a failed launch with its reason, not a crash.
- **Stop and restart** - a stop during a launch closes the browser the launch then hands over and leaves the state off; repeated starts are one launch; a restart closes the running browser and launches again.
- **Sign-in needed** - a running browser whose claude.ai tab is on `/login` or `/logout` says a sign-in is needed; one on `/code` does not.
