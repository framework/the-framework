The browser-bridge endpoints and store: how a question a *cloud* session is parked on (relayed by the claude.ai extension) becomes a card in the dashboard, and how the picked answer travels back.

## Decisions

- **Minimal payload as the security stance**: one fully validated shape with no path, command, prompt, or free text anywhere — the worst a stolen token buys is a bogus question card. The bearer token is checked in constant time *before the body is read*, and all sizes are hard-capped.
- **No CORS headers on purpose**: the extension's service worker fetches with host permissions and needs none; a wildcard would let any page the user visits post to their daemon. The cost is one line in the extension.
- Answers are constrained to a **label of the currently parked question** — the bridge can never type arbitrary text into a session.
- The store is in-memory on purpose: a question is only answerable while its session is parked, and the extension re-reports on reconnect — surviving a restart would resurrect questions already answered elsewhere.

## Facts

- Questions are fingerprinted and matched against answered ones, because the extension forgets what it sent on restart while the answered block stays in the page DOM — the same question would otherwise re-park immediately after being answered. A *genuinely new* question clears any queued undelivered pick for the old one.
- Transcript entries are keyed by sequence number, not appended — the page is re-read on every DOM change, so the same message arrives repeatedly and a later read can replace a streaming one.
- Failed requests are still recorded as contact, because a misconfigured extension otherwise looks identical to an uninstalled one.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
