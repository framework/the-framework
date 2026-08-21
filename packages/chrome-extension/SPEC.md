A Chrome extension bridging Claude Code cloud sessions on claude.ai to the local dashboard: the question a parked session is waiting on travels home, and the answer picked in the dashboard travels back into the session.

## User Stories

- The user sees the question a parked cloud session is waiting on in the dashboard, without watching claude.ai.
- The user answers it in the dashboard, and the answer is typed back into the claude.ai session.
- The user follows the cloud session's transcript from the dashboard.

## Flows

- A cloud agent hands off and ends, so when its session later asks something, nothing streams back — the question strands on claude.ai. The extension reads the session page the user is already signed into and carries the question — plus a mirror of the transcript — to the daemon, so the dashboard shows both.
- Two halves with a strict trust line: the page script reads claude.ai and types into it but never holds a secret; the background worker holds the bridge token and is the only part that talks to the daemon.
- The user's answer goes the long way round: dashboard pick → daemon queue → worker → typed into the session's composer and submitted. The extension can only ever type a label the session itself offered, and the pick was confirmed in the dashboard first.
- The bridge works with nobody looking at claude.ai: the extension keeps one pinned background tab per session the daemon watches, closes them when watching stops, and never reopens one the user closed.
- Reading is driven by page changes with a slow heartbeat backstop, and every stage reports its status — on the page's panel and in the settings page's connection test — so a silent misconfiguration is visible.
- The extension and the daemon insist on matching versions: every call states the extension's version, and a daemon expecting another blocks it with an error naming both and the update path.

## Rationales

- **The trust line.** The daemon refuses cross-origin calls on purpose, so no website the user visits can reach the dashboard; only the background worker is exempt, and nothing sharing a tab with claude.ai should ever hold the secret — which is why the token and every daemon call live in the worker.
- **Built for background tabs.** The bridge lives in pinned tabs nobody looks at, where the browser throttles timers — so reading rides on page changes and the heartbeat is only a backstop.
- **Versions must match.** A version-skewed extension–daemon pair half-works in ways that read as bugs, so the daemon blocks it loudly instead of degrading.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
