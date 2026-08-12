A Chrome extension bridging Claude Code cloud sessions on claude.ai to the local dashboard: the question a parked session is waiting on travels home, and the answer picked in the dashboard travels back into the session.

## TLDR

- A cloud run hands off and ends, so when the session later asks something, nothing streams back and the question strands on claude.ai; the extension reads the session page the user is already signed into and carries the question — plus a mirror of the transcript — to the daemon.
- Two halves with a strict trust line: the page script reads claude.ai and types into it but never holds a secret; the background worker holds the bridge token and is the only part that talks to the daemon — which refuses cross-origin calls on purpose, so no website the user visits can reach the dashboard.
- Answers go the long way round: dashboard pick → daemon queue → worker → typed into the session's composer and submitted; the extension can only ever type a label the session itself offered, and the pick was confirmed in the dashboard first.
- It keeps one pinned background tab per session the daemon watches, so the bridge works with nobody looking at claude.ai — closing tabs when watching stops, and never reopening one the user closed.
- Reading is driven by page changes with a slow heartbeat backstop (it lives in background tabs), and every stage reports its status — on the page's panel and in the settings page's connection test — so a silent misconfiguration is visible.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
