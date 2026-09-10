Runs the extension's options page, the one place the user configures the Claude web bridge [1] extension by hand: it keeps the dashboard's address, the bridge token [2] and the "Run the Driver tab" switch in extension storage, proves the connection with "Save and test" and tells the ways it can fail apart, shows what the worker's [3] last cycle [4] did, and reopens the Driver tab [5] on demand.

## Context

**User story**:
- The user loads the extension into their own Chrome, opens its options page, pastes the token the dashboard's Settings shows while the bridge is on, and presses "Save and test"; the page says "Connected" and how many sessions are being watched, or names what is wrong.
- The user wonders why the bridge is doing nothing and reads the page's last-cycle line instead of opening a worker console.
- The user closed the Driver tab earlier and presses "Open the Driver tab now" to resume the bridge.

**Problem**: the token lives in extension storage rather than in any page, so nothing on claude.ai can read the secret that talks to the daemon. A token that is merely stored tells the user nothing, and the two ways a connection goes wrong, bridge off and wrong token, look alike from outside; a missing site grant looks like a wrong token too, and cost an evening once.

## Glossary

[1] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[2] bridge token: the secret the extension presents.
[3] worker: the extension's background service worker: the half of the extension that holds the bridge token and talks to the daemon; Chrome runs it without any page and ends it when idle.
[4] cycle: one pass of the worker's loop, twice a minute: list the sessions to serve, read their list statuses, visit what is due, account for every answer and session request.
[5] Driver tab: the extension's one pinned tab that reads claude.ai's session list, visits sessions and types answers.
[6] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.

## Business logic — TL;DR

- **What the page holds** - "Dashboard URL" (default `http://localhost:4200`), "Bridge token" (a password field) and "Run the Driver tab" (on by default once saved, and stored explicitly), all in extension storage.
- **Save and test** - the values are saved first, then proven: a missing site grant, a wrong token, a bridge that is off, a version mismatch, a dashboard without the bridge and an unreachable dashboard each get their own message, and a working connection says how many cloud sessions are watched.
- **Open the Driver tab now** - lifts the pause a closed Driver tab left and runs a cycle at once, reporting what the cycle did or why it did nothing.
- **The last cycle's line** - what the worker last recorded, kept live while the page is open.

## Business logic

### What the page holds

#### Context

See `## Context`.

#### Business logic

The page shows "Dashboard URL", filled with the stored address or `http://localhost:4200`; "Bridge token", a password field filled with the stored token; and the "Run the Driver tab" checkbox, checked unless it was explicitly switched off, with the explanation that the Driver tab [5] is one pinned background tab that reads claude.ai's session list, visits the cloud sessions [6] waiting on the user and types their answers, that without it the bridge does nothing, that closing the tab pauses it and the button below reopens it. On save the address loses its trailing slashes and falls back to the default when empty, the token is trimmed, and the checkbox is stored as it stands so the worker [3] never has to guess.

### Save and test

#### Context

See `## Context`.

#### Business logic

An empty token stops the save with "Paste the bridge token first." Otherwise the three values are saved, the page says "Saved. Testing…", and the test runs in this order:
- Site access first. Chrome must have granted the extension access to the dashboard's origin and to `https://claude.ai/`; declaring them in the manifest is not the same as holding them, and without the dashboard grant the worker's [3] call is blocked before it leaves the browser and the daemon sees nothing. A missing grant stops the test with "Chrome has not granted access to <origins>. Open chrome://extensions, find this extension, and switch those on under Site access."
- Then the daemon is pinged with the token and the extension's version. A 401 says "The dashboard is reachable but rejected the token."; a 404 says "Reached the dashboard, but the bridge is off. Turn it on in The Framework."; a 426 shows the daemon's own text, which names both versions and the way out; any other failure says "The dashboard answered <status>.". A 200 is not enough: the dashboard serves its app for any path it does not know, so a body that is not exactly `ok` means "That dashboard has no bridge route. Update The Framework, then try again."
- Then the read path is proven too, not just the credential: the daemon is asked which cloud sessions [6] it wants watched. The result reads "Connected. The bridge is on and the token works." followed by " Watching <n> recent cloud session(s), the Driver tab serves them." when the switch is on, " Watching <n> recent cloud session(s) (the Driver tab is off)." when it is off, " No recent cloud sessions to watch yet." when the list is empty, or " Could not list sessions." when that call failed.
- A dashboard that cannot be reached at all says "Could not reach <address>. Is the dashboard running?".

### Open the Driver tab now

#### Context

**Problem**: the worker's [3] clock fires twice a minute, which is a long time to sit wondering whether anything is wrong; and a Driver tab [5] the user closed stays paused until something resumes it.

#### Business logic

The button says "Driving…", lifts the pause a closed Driver tab [5] left, and asks the worker [3] for a cycle [4] at once. The page then reports "Driver cycle done: <what it did>." or "Did nothing: <why>", where the reasons are the same ones the worker records for every cycle; when the worker does not answer, "The worker did not answer. Try reloading the extension." or Chrome's own error.

### The last cycle's line

#### Context

**User story**: the user reads on this page why the bridge is doing nothing, or that the worker [3] just reloaded the extension because its files changed on disk.

#### Business logic

Below the buttons the page shows the worker's [3] record of its last cycle [4]: "No cycle has run yet." before any, else "Last cycle at <time>: <reason>", with "failed — " before the reason of a cycle that did nothing, and "no reason recorded" when the record carries none. The worker records every cycle, and each record redraws the line while the page is open.
