The saved daemons this browser can hop between — each remembered as a label, an address, and a per-browser access token.

## TLDR

- Saved only in this browser, on purpose: the token is a per-browser secret and must never land in the daemon's shared registry.
- Switching devices is a navigation: the browser goes to the other daemon's address carrying the token once (plus any half-typed prompt, unless oversized), after which everything is same-origin again.
- Pasting a device's printed URL saves it; pasting the same box again refreshes its token rather than duplicating the entry.
- "Local" remembers the address the dashboard was launched from, so it can find the way back from a remote box.
- An indicator names the daemon currently connected: Local on this machine, otherwise the saved device's label or its bare host.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
