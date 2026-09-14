Priority: 8
Topics: [UX]
GitHub: [#1332](https://github.com/framework/the-framework/issues/1332)

# Spike: Is it possible to make the extension headless?

## TLDR

**Answered and built (2026-08-26).** Headless is no: Cloudflare's interstitial on claude.ai never clears in a headless browser, whatever the profile or cookies, and faking a headed fingerprint was rejected. The agreed shape was built instead, in three merged steps:

1. **The Driver tab** (#1703, #1707): one pinned tab cycles every web run's session, routed by the claude.ai/code sidebar. Each row's status icon carries a plain-text `aria-label` (`Awaiting input`, `Unread response`, `Idle`, PR state), so only waiting sessions are visited, by in-app navigation. A full-page "The Framework Driver" overlay with debug logs marks the tab.
2. **Dashboard state from the reported status** (#1668): `cloudRunState` shows a real waiting/running.
3. **The daemon-owned browser** (#1718): behind a "Bridge browser" preference, the daemon downloads Chrome for Testing, installs the extension over CDP `Extensions.loadUnpacked` with developer mode on (so the #1712 self-reload works; `--load-extension` gets the extension disabled on reload), seeds the token, and keeps the window minimized (macOS clamps off-screen positions; minimized still passes Cloudflare). Settings raises it for the one-time sign-in. Two Drivers can serve one daemon; an answer is claimed on read.

Dogfooded end to end on macOS with the user's own Chrome quit. The maintainer confirmed on Linux (2026-08-27) — with one bug found.

## What is left

- **Bug: enabling the bridge and picking the daemon's browser in the same daemon session crashes the daemon.** The browser only launches if the daemon started with the bridge already on; the failed launch throws instead of reporting. Fix: show "restart the dashboard first" (or launch properly) instead of crashing. Promised on the thread 2026-08-27, not yet confirmed fixed.
- Linux without a display needs Xvfb; unbuilt, not ticketed until someone runs a headless-server daemon. Windows untested.
- Split out: #1720 (ship the extension inside the npm package, so the daemon's browser works outside a checkout) and #1719 (closed).
- The spike itself is answered; closing the issue is the maintainer's call.

## Why it matters

Web runs no longer depend on the user's Chrome being open, and one tab scales to many sessions. The remaining crash is what the maintainer hit on first try, so it is the blocker for anyone else enabling the daemon's browser.

## Source

Imported from GitHub issue [framework/the-framework#1332](https://github.com/framework/the-framework/issues/1332), created 2026-07-28, labels: `priority: high`, `UX ✨`. Comments folded through 2026-08-27T15:15Z. The body cross-links #1554 (choices support in the CC web driver) as the other half of full-fledged CC web support.
