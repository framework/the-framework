Priority: 8
Topics: [UX]
Issue: [#1332](https://github.com/framework/the-framework/issues/1332)

# Spike: Is it possible to make the extension headless?

## TLDR

**Answered and built; closing is the maintainer's call.** Headless is out: the extension runs headless, but claude.ai's Cloudflare check never clears a headless browser (cookies do not help, faking the fingerprint was rejected). The agreed shape was built instead, in three merged steps:

1. **The Driver tab** (#1703/#1707): one tab cycles through the sessions, routed by the session list's status icons (readable in code as plain `aria-label`s — the precondition held), instead of one tab per session.
2. **Dashboard state from the reported status** (#1668).
3. **The daemon-owned browser** (#1718, behind the **Bridge browser** preference): the daemon downloads Chrome for Testing, installs the extension over CDP `Extensions.loadUnpacked` with developer mode on (a `--load-extension` install is disabled by Chrome 137+ on the extension's self-reload from #1712), seeds the token, opens the Driver tab and keeps the window **minimized** (macOS clamps off-screen positions back; a minimized headed window passes Cloudflare). Dogfooded on macOS with the user's own Chrome quit.

**What is left here:**

- **Linux:** untried; a headed browser needs a display (Xvfb), not built. Windows untested. **Waits for web runs to come back:** the web-run driver was deleted when runs moved to the agent scheduler, so nothing uses the bridge browser for a run today, and Linux support would have no user and no way to dogfood it. Do not queue this ticket before then.

Done since: the crash when the bridge is switched on after the daemon started is fixed (#1723): the launch now fails with "restart the dashboard" instead of crashing the daemon. #1720 (ship the extension in the npm package) is done (#1789). #1719 (an agent's browser outliving a hard-killed agent) was closed.

## Why it matters

The extension path is the shipped direction for web runs. The Driver tab is what lets one browser serve 50 sessions, and the daemon's own browser is what lets web runs work without the user's Chrome open.

## Source

Imported from GitHub issue [framework/the-framework#1332](https://github.com/framework/the-framework/issues/1332), created 2026-07-28, labels: `priority: high`, `UX ✨`, 28 comments (last folded: 2026-08-27T15:15Z).

### Notes from the GitHub thread

- Once the extension is on the Web Store, the daemon's Chrome can install it through the `ExtensionInstallForcelist` policy, with no developer mode and no reload problem. Prerequisite: accept a minimum extension version instead of the exact one (#1519).
- Two Drivers can serve one daemon (the user's Chrome and the daemon's browser), so an answer is claimed on read and never typed twice.
