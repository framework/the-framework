Effort: 1
Uncertainty: 2

# [Plan] Spike: Is it possible to make the extension headless?

What is left of this spike once the code is checked against the ticket, and what to do with it.

## TLDR

Nothing is left to build now. The ticket's crash is fixed. The only open item is Linux, and it has no user today: nothing starts a web run anymore. Recommended: close the ticket. If it stays open, it waits until web runs come back.

## What the code says today

- **The crash is fixed** (#1723). The daemon's launcher checks for the bridge token first (`packages/framework/src/daemon.ts:161-173`). A bridge switched on after boot gets the error "restart the dashboard, and the browser launches on its own". The owner turns any throw from the launcher into a `stopped` state with that reason, never an unhandled rejection (`packages/framework/src/bridge-browser.ts:565-597`). A test covers it: "a launcher that throws before launching is a failed launch with the reason, not a crash (#1332)" (`bridge-browser.test.ts:362`).
- **#1720 is done** (#1789). The extension ships inside the framework package, so the bridge browser also works from npx.
- **Web runs are gone.** The web-run driver (`src/driver/cloud.ts`, `target-driver.ts`) was deleted on purpose when the launcher moved runs to the agent scheduler. The bridge browser, the bridge store and the extension stayed in the daemon. Today the bridge browser launches and holds a Driver tab, but no run of this project creates a cloud session through it.
- **Linux is untried.** The launch is headed (`bridge-browser.ts:44`) and only macOS gets special handling (`:400`, `open` on the app bundle). On a Linux machine without a display, Chrome for Testing downloads, and then the headed launch fails. The owner reports that as `stopped` with Chrome's reason: no crash, just no bridge browser. Windows is untested.

## Problems

### 1. Linux without a display — uncertainty 2

A headed browser needs an X server. The known fix: start `Xvfb` (or run under `xvfb-run`) and give Chrome a `DISPLAY`. A Linux desktop with a display should work as it does today, with a minimized window. That is untested too.

### 2. Nobody needs it yet — decides the timing

Linux only matters for a daemon running on a server, and only for web runs. Web runs come back with the web step (the driver callable by `agent-scheduler run`). Building Xvfb support before then means work that has no user and no way to dogfood it.

## Solutions

1. **Close the ticket (recommended).** The spike's question is answered (headless: no; a minimized headed browser: yes), and what it built is merged. File Linux as its own ticket when web runs return. The ticket's own TLDR already says closing is the maintainer's call.
2. **Keep it open, gated on web runs.** Take the Linux work (below) when the web step lands.
3. **Build Linux now.** Not recommended, for the reason in problem 2.

## Implementation (Linux, when web runs are back)

1. When `process.platform === 'linux'` and `DISPLAY` is not set, start `Xvfb :<free display>` beside Chrome and pass its `DISPLAY` in Chrome's environment. Close Xvfb when the browser closes, in the same `close` / `onExit` path.
2. When `Xvfb` is not installed, fail the launch with a line that names the fix ("install xvfb, or run the dashboard on a machine with a display"). Nothing to add in the owner: it already reports a launch failure as `stopped` with its reason.
3. A unit test through the injected `spawn` (the pattern `bridge-browser.test.ts` already uses): on Linux without `DISPLAY`, Xvfb is spawned first and Chrome gets its display.
4. Dogfood once on a real Linux box: sign in once, then check that a web run's session is read.

## Considerations

- The ticket text is behind the code. Its "crash to fix" bullet is done (#1723). Whoever closes or re-queues the ticket should drop that bullet first.
- The Web Store route in the thread notes (`ExtensionInstallForcelist`, after #1519) still stands. It removes developer mode and the unsafe-debugging flag, and it is independent of Linux.
- The agent's own browser (the separate ticket "The agent's browser as a package") is a different browser. It is headless and runs per run, so none of this applies to it.
