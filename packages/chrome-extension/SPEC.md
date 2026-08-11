The Claude web bridge: a Chrome extension inside the user's own claude.ai tab that carries a cloud session's parked question home to the local dashboard, and types the picked answer back into the session's composer.

## TLDR

- A cloud run hands off and ends, so when the session later asks something there is nothing streaming back — the question is stranded on claude.ai; this extension watches the signed-in session page and reports the question to the daemon.
- The answer travels the other way: pick an option in the dashboard, confirm the send, and the extension types that label into the session's composer and submits it.
- The extension only ever types a label the session itself offered, the pick has to be confirmed in the dashboard, and a queued pick can be withdrawn until the extension collects it.

## Flows

- **Question out**: the page script spots the parked question in the session page and hands it to the background worker, which posts it to the daemon's bridge; the dashboard shows it as an answerable card within seconds.
- **Answer back**: the worker polls the daemon for a confirmed pick, delivers it to the page script to type and submit, and acknowledges the delivery so it is never typed twice.

## Rationales

- The daemon's token lives in the background worker, never in the page — a page script shares the tab with claude.ai, and nothing on that page should be able to read the secret that talks to a daemon.
- The daemon deliberately answers no cross-origin headers (a wildcard would let any site you visit post to your dashboard), so the fetch must come from the worker, which isn't subject to that restriction.
- The page is watched rather than polled, because Chrome slows timers in long-hidden tabs and the bridge is meant to run from a pinned background tab; the slow interval is only a backstop.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
