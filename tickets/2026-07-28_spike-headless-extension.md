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

- **A crash to fix:** the daemon's browser only launches if the daemon was started with the bridge already on. Turning the bridge on and picking the browser in the same daemon session fails the launch, and the failure crashes the daemon instead of reporting an error (hit by the maintainer on 2026-08-27). Wanted: an error saying "restart the dashboard first", no crash.
- **Linux:** untried; a headed browser needs a display (Xvfb), not built. Windows untested.

Filed separately: #1720 (ship the extension in the npm package, so the daemon's browser works outside a checkout); #1719 (an agent's browser outliving a hard-killed agent, closed).

## Why it matters

The extension path is the shipped direction for web runs. The Driver tab is what lets one browser serve 50 sessions, and the daemon's own browser is what lets web runs work without the user's Chrome open. The crash above sits on the recommended setting's first-use path.

## Source

Imported from GitHub issue [framework/the-framework#1332](https://github.com/framework/the-framework/issues/1332), created 2026-07-28, labels: `priority: high`, `UX ✨`, 28 comments (last folded: 2026-08-27T15:15Z).

### Notes from the GitHub thread

- Once the extension is on the Web Store, the daemon's Chrome can install it through the `ExtensionInstallForcelist` policy, with no developer mode and no reload problem. Prerequisite: accept a minimum extension version instead of the exact one (#1519).
- Two Drivers can serve one daemon (the user's Chrome and the daemon's browser), so an answer is claimed on read and never typed twice.
