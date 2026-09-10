What the tests cover, for the browser an agent drives:

- **The launch flags** - Chrome is launched with its debugging port open, on a throwaway profile rather than the user's, headless by default, opening a blank page; a visible window can be asked for.
- **Finding Chrome** - an explicit `CHROME_PATH` or `PUPPETEER_EXECUTABLE_PATH` wins over the well-known locations; an override pointing at nothing is passed over rather than hiding a browser that is installed; a browser is found on `PATH` when no standard install exists; a machine with no Chrome at all resolves to nothing, which is what makes the browser option fall back.
- **A free port** - the port asked of the operating system is one nothing listens on.
- **Waiting for the debugging endpoint** - the wait ends as soon as the endpoint answers, and gives up within its time limit instead of hanging the agent when Chrome never listens.
- **A browser that never opens its port** - launching a binary that never listens yields no browser, never a handle to a browser nothing is behind.
- **Wiring the browser tools** - with a shared browser the tool server is pointed at its URL; without one it is the unchanged launch-its-own tool server; the browser option folds the URL into the driver's options, and without the option the options are untouched, URL or not.
- **The browser dies with its agent** - an agent process that exits without closing its browser kills it outright at exit; a browser closed the ordinary way disarms that exit hook and leaves no listener behind; launching arms the hook and closing removes it.
- **Telling orphans from owned browsers** - a browser whose parent is a live Node agent is owned, also when Node sits under a path with spaces; one reparented to the init process, to a non-Node process such as a terminal multiplexer, or to a parent no longer in the listing is an orphan, reported with its profile directory; a browser's helper processes, the daemon's own bridge browser on its own profile, and processes without an agent profile are left alone.
- **The start-up sweep** - every orphan is killed and its profile removed, including one that exited between the listing and the kill; on Windows the sweep does nothing rather than failing.
- **Against the real machine** - a browser process the init process inherited is found and killed, while one a live agent holds is spared.
