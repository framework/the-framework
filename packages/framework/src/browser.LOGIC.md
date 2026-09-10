Gives an agent [1] started with its browser option a real Chrome to drive: The Framework launches Chrome itself, on a debugging port it opened, so that the coding agent [2]'s browser tools and the dashboard's live preview attach to the same page at once. It finds Chrome on the machine, launches it headless on a throwaway profile, closes it with the agent, and at daemon start-up kills the browsers that dead agents left behind. A machine without Chrome costs the agent its preview, never its browser tools.

## Context

**User story**: the user starts an agent with the browser option on. The agent can open pages, read the console, the network and the DOM, and take screenshots, and the user watches the very page the agent is on in the dashboard (the screencast is in `browser-stream.ts`). Nothing of this touches the user's own Chrome session: the agent's browser runs on a profile of its own that is thrown away when the agent ends.

**Problem**: a browser the agent's tool server launches for itself takes one client, the agent; a second client cannot attach to a browser whose debugging port was never opened. Launching Chrome here, with a known port, is what lets the preview and the user's step-in watch the agent's page.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] coding agent: the CLI doing the actual work: Claude Code or Codex.
[3] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.

## Business logic — TL;DR

- **Finding Chrome on the machine** - an explicit path in the environment wins, then the platform's well-known install locations, then the usual binary names on `PATH`; none means no browser.
- **Launching the shared browser** - headless by default, on a free port the operating system hands out and a throwaway profile, ready only once its debugging endpoint answers within 15 seconds.
- **A missing browser costs the preview, never the tools** - the agent's browser tools are always wired; with a shared browser they attach to it, without one they launch a browser of their own.
- **Closing, and never leaving a Chrome behind** - closing kills Chrome and removes its profile; a Chrome that dies on its own closes itself; an agent process that exits without closing takes its Chrome with it.
- **Sweeping orphaned agent browsers at daemon start-up** - every browser on a profile carrying the agent mark whose parent process is gone is killed and its profile removed.

## Business logic

### Finding Chrome on the machine

#### Context

**Problem**: Chrome lives in different places per platform and per install, and a user on a non-standard install must not be stuck.

#### Business logic

The Chrome to launch is, in order, the first that exists: the path in `CHROME_PATH`, then the path in `PUPPETEER_EXECUTABLE_PATH` (a repository that sets it usually means it); then the platform's well-known locations: on macOS the Google Chrome and Chromium applications, on Linux `/opt/google/chrome/chrome`, `/usr/bin/google-chrome`, `/usr/bin/chromium` and `/usr/bin/chromium-browser`, on Windows Chrome under either Program Files directory; then `google-chrome`, `google-chrome-stable`, `chromium` and `chromium-browser` looked up on `PATH`, with `.exe` and `.cmd` also tried on Windows. When nothing is found, the machine has no browser to share.

### Launching the shared browser

#### Context

See `## Context`.

#### Business logic

- Chrome starts headless by default, since the agent [1] has no screen and a screencast reads a headless page fine; a caller may ask for a visible window.
- It listens for debugging clients on a free localhost port asked of the operating system rather than guessed, and runs on a fresh throwaway profile directory in the system temporary directory whose name starts with `framework-chrome-`, so an agent never inherits or dirties the user's real Chrome session. It opens with no first-run or default-browser prompts, a 1280 by 720 window, and a blank page.
- The browser counts as launched only once its debugging endpoint answers, polled every 100 milliseconds for up to 15 seconds: handing the tools a port that is not listening yet would be a race. A Chrome that never answers in time is closed and counts as no browser.
- A launch that fails outright, for a bad path or a file that cannot be executed, removes the profile and counts as no browser; it never takes the agent down.
- The shared browser is known to the rest of the product by one URL, the endpoint both the agent's tools and the preview attach to.

### A missing browser costs the preview, never the tools

#### Context

See `## Context`.

#### Business logic

The browser tools are one tool server, `chrome-devtools-mcp`, fetched on demand through `npx` so there is nothing to pre-install, and merged into the driver [3]'s options only when the agent's browser option is on. With a shared browser it is pointed at that browser's URL, so it attaches instead of launching one. Without a shared browser it is given no URL and launches its own browser exactly as it would on its own; the agent keeps every browser tool and only the dashboard's preview is lost.

### Closing, and never leaving a Chrome behind

#### Context

**Problem**: a headless Chrome that nobody owns runs for days. The agent's process reaps nothing on its own, so an agent that leaves abruptly would leave its Chrome running under the init process.

#### Business logic

- Closing the shared browser kills Chrome and removes its throwaway profile; closing twice is harmless.
- A Chrome that dies on its own, or that failed to start, closes itself the same way, so the agent [1] is never left pointing at a dead port.
- When the agent's process exits before the browser was closed, by an explicit exit such as the second Ctrl-C or by an uncaught error, Chrome is killed at that exit. A death by signal is the CLI's to handle, by stopping the agent, which closes the browser; a death nobody can handle is the daemon's, which kills the agent's whole process group.

### Sweeping orphaned agent browsers at daemon start-up

#### Context

**Problem**: the two guards above live inside the agent's process. A Chrome whose agent was killed outright under a daemon that is gone, or that was launched before the guards existed, outlives them all.

#### Business logic

- At daemon start-up the process table is read. An agent browser is a browser process whose profile directory name starts with `framework-chrome-`, which is the ownership mark, and which is the browser itself rather than one of its helper processes (renderers repeat the profile flag but carry a process type). It is orphaned when its parent is gone: reparented to the init process, to a process no longer in the table, or to a process that is not Node, since only a Node agent [1] ever launches these browsers and any other parent is the init, subreaper or shell that inherited it.
- Every orphan is killed outright and its profile directory removed; a browser gone between the listing and the kill is skipped. What was closed is reported back, for the daemon's start-up log line.
- Windows has no process listing of this kind, so the sweep does nothing there.
