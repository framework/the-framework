Runs the daemon's own browser for the Claude web bridge [1]: a Chrome for Testing the daemon downloads once, launches with a visible window it keeps minimized on a persistent profile of its own, installs the bridge's extension into over Chrome's debugging connection, and hands the daemon's address and the bridge token [2], so that the question a cloud session [3] is parked on reaches the dashboard, and the pick [4] is typed back, even while the user's own Chrome is closed. The daemon brings the window up when the user has to sign in to claude.ai, stops a browser a dead daemon left behind before launching, and reports each step of the launch and every stop to the dashboard.

## Context

**User story**: the user switches the bridge browser [5] on in Settings. The dashboard shows the launch step by step, the first time including the download of Chrome for Testing, then shows the browser as running. While the browser's claude.ai tab sits on the sign-in page the dashboard says a person has to sign in and offers to show the window; the user signs in once, and the sign-in outlives every daemon restart. The user can show, hide or restart the browser from the dashboard. A browser the user quits is reported as stopped and is not relaunched behind their back.

**Problem**: the bridge's far end is a browser signed in to claude.ai. Left to the user's own Chrome, a web agent could only start, and a parked question could only be noticed, while that Chrome happened to be open. A browser nobody attends has to be headed, because claude.ai's bot gate never clears a headless one; Chrome for Testing, because branded Chrome no longer loads an unpacked extension handed to it from outside; and installed over the debugging connection with developer mode on, because an extension loaded any other way is disabled the first time it reloads itself. Nothing here talks to claude.ai: once the extension holds the token, its Driver tab [6] does exactly what it does in the user's own Chrome, and the daemon only keeps the window out of the way.

## Glossary

[1] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[2] bridge token: the secret the extension presents.
[3] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[4] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[5] bridge browser: the Chrome for Testing the daemon runs for the bridge.
[6] Driver tab: the extension's one pinned tab that reads claude.ai's session list, visits sessions and types answers.
[7] registry: `~/.the-framework.json`, which keeps the user's preferences and lists the projects.

## Business logic — TL;DR

- **Where the bridge browser lives** - under `$XDG_CONFIG_HOME/the-framework-browser` when that variable is set, else `~/.the-framework-browser`, beside the registry, with a profile that persists across restarts.
- **Chrome for Testing, downloaded once** - the newest Chrome for Testing already under that directory, else the current stable build downloaded there with progress reported.
- **The extension files come from a checkout** - the extension is taken from `packages/chrome-extension` next to this package, so the bridge browser runs only from a checkout.
- **Stopping a browser a dead daemon left behind** - whatever process holds the profile's lock is asked to leave, given 5 seconds, then killed.
- **The launch** - headed, on a free port, on the persistent profile, without the OS keychain, ready only once the debugging port answers within 30 seconds.
- **Installing the extension, with developer mode on** - the extension is installed over the debugging connection and Chrome's developer-mode switch is flipped on so the extension survives reloading itself.
- **Handing the extension the token and opening the Driver tab** - the daemon's address and the bridge token are written into the extension's own storage, and the Driver tab is opened as the one pinned claude.ai tab.
- **Kept minimized, shown for sign-in** - every window is minimized after setup; showing restores it and brings the claude.ai tab to the front, hiding minimizes it again.
- **A half-set-up browser is never left running** - a failure at any step after the launch closes the browser and names the step.
- **One bridge browser per daemon, and what the dashboard is told** - off, starting with the current step, running with whether a sign-in is needed, or stopped with the reason; a browser that exits on its own is not relaunched.

## Business logic

### Where the bridge browser lives

#### Context

**Problem**: the user signs in to claude.ai once; the sign-in has to outlive every daemon restart. A test's browser must never touch the machine's real one.

#### Business logic

The bridge browser [5]'s directory holds its profile and its binary: `$XDG_CONFIG_HOME/the-framework-browser` when that variable is set, else `~/.the-framework-browser`. It sits beside the registry [7], so the same variable that isolates a test's registry isolates its browser. The profile inside it is persistent on purpose.

### Chrome for Testing, downloaded once

#### Context

**Problem**: branded Chrome ignores an unpacked extension handed to it from outside, and the lookup that finds Chrome for an agent's browser would find exactly that.

#### Business logic

The browser is the newest Chrome for Testing already under the directory's `chrome` cache. When none is there, the current stable build is looked up and downloaded once, about 150 MB, and the launch reports "looking up the current Chrome for Testing", "downloading Chrome for Testing <build>" and then the same line with a percentage as the download progresses. A platform Chrome for Testing has no build for fails the launch.

### The extension files come from a checkout

#### Context

See `## Context`.

#### Business logic

The extension's files are the checkout's `packages/chrome-extension`, next to this package. The extension is not part of the published package, so outside a checkout the launch fails at once with "the extension files are not beside this package (packages/chrome-extension): the bridge browser runs from a checkout".

### Stopping a browser a dead daemon left behind

#### Context

**Problem**: a daemon that died without closing its browser leaves that browser running on the profile, and a second Chrome started on the same profile hands its command line to the first and exits at once. The profile is The Framework's own, so whatever holds it is The Framework's own leftover; nothing the user runs shares it.

#### Business logic

Before launching, the process holding the profile's lock is read off the lock Chrome leaves in the profile. When that process is alive and is not this daemon, it is asked to terminate, given up to 5 seconds to leave, and killed outright if it is still there; the launch then reports "stopped a browser an earlier daemon left behind". A lock nobody holds is left alone.

### The launch

#### Context

See `## Context`.

#### Business logic

- Chrome for Testing starts headed, since claude.ai's bot gate rejects a headless browser outright while a headed one whose window is minimized passes. It listens for debugging clients on a free localhost port, runs on the persistent profile, keeps its cookie-encryption key out of the operating system's keychain, since macOS would otherwise ask for the login password on every launch and Linux for the wallet, and the profile directory's own permissions are what guard the sign-in. Debugging of extensions is enabled, which is what allows installing the extension over the connection. It opens with no first-run or default-browser prompts, a 1280 by 900 window, and a blank page. The step is reported as "starting Chrome for Testing".
- The browser is ready once its debugging port answers, waited for up to 30 seconds. A Chrome that never answers fails the launch with "Chrome never opened its debugging port", or with how it died: "Chrome exited on <signal>", "Chrome exited with code <code>", or "Chrome could not start: <error>".

### Installing the extension, with developer mode on

#### Context

**Problem**: Chrome disables an unpacked extension on reload while developer mode is off, and the extension reloads itself whenever its files change, so without the switch the bridge would die on the first edit or pull. The profile remembers the switch, but writing the preference into the profile directly does nothing; the switch on Chrome's extensions page is the one way that works.

#### Business logic

- The extension is installed from its directory over the debugging connection, reported as "installing the extension"; Chrome answers with the extension's id, and an install that names none fails the launch.
- Chrome's extensions page is then opened in the background, its developer-mode switch is flipped on when it is off, and the page is closed. The page is tried up to 40 times, a quarter of a second apart, before the launch fails with "could not switch developer mode on in chrome://extensions".

### Handing the extension the token and opening the Driver tab

#### Context

**Problem**: the extension opens no Driver tab [6] while the daemon lists no cloud session [3], and the user has to sign in on that tab before any cloud session exists.

#### Business logic

Reported as "handing the extension the bridge token", the launch runs inside the extension's own worker: the daemon's address and the bridge token [2] go into the storage the extension's options page would have written, with automatic opening switched on, and the Driver tab is opened as the one pinned, active `https://claude.ai/code` tab while every other tab, the blank page included, is closed. The worker is waited for up to 40 times a quarter of a second apart; a worker that never appears fails the launch with "the extension's worker never appeared", and one that does not take the token with "the extension's worker did not take the token".

### Kept minimized, shown for sign-in

#### Context

**User story**: the browser stays out of the user's way; when a sign-in is needed the user asks the dashboard to show it, signs in on the page it brings up, and hides it again.

#### Business logic

- Once set up, every window of the browser is minimized. Minimized rather than moved off-screen, because macOS keeps a sliver of any off-screen window on the screen, and because Cloudflare lets a minimized window through.
- Showing restores every window, brings the claude.ai tab to the front, which is the Driver tab [6] or the sign-in page it was redirected to, and on macOS activates the application so it comes up over the dashboard. Hiding minimizes every window again.
- The browser reports which page its claude.ai tab is on, as the path of that tab's address, or nothing when no such tab exists.

### A half-set-up browser is never left running

#### Context

See `## Context`.

#### Business logic

A failure at any step after Chrome was launched closes the browser before the failure is reported: the browser is asked to close itself, given 3 seconds, then killed. Closing an already exited browser only drops the connection, and closing twice is harmless. The failure names the step that failed.

### One bridge browser per daemon, and what the dashboard is told

#### Context

**Problem**: a launch is slow, the first one downloads Chrome, and the user needs to see where it is; a stop that lands mid-launch must not leave the launched browser running unowned; a failure inside the launch must never bring the daemon down.

#### Business logic

- A daemon runs one bridge browser [5]. Its state is one of: "off"; "starting" with the step under way, "preparing" before the first step reports; "running" with when it started, whether its window is shown, and whether a sign-in is needed; or "stopped" with the reason.
- A sign-in is needed while the claude.ai tab's path is `/login` or `/logout`, the pages a signed-out browser lands on.
- Starting while the browser runs or a launch is under way does nothing more. Stopping cancels a launch under way, closing the browser that launch then hands over rather than leaving it running, and closes a running browser; the state goes to "off".
- A browser that exits on its own, because the user quit it or it crashed, is reported as "stopped" with the reason and logged as "the bridge browser stopped: <reason>"; it is not relaunched, since quitting it was an act, and the dashboard offers a restart instead. A launch that fails is reported as "stopped" with the failure's message and logged as "the bridge browser could not start: <reason>". A launch that fails before it can even begin, such as when the bridge token does not exist, goes the same way and never escapes as an error that would end the daemon.
- The dashboard's actions are "show" and "hide", which also record whether the window is shown, and "restart", which stops and then starts. Show and hide do nothing without a running browser.
