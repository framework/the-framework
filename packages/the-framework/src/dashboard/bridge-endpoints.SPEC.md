The daemon's doorway for the browser extension in the user's own claude.ai tab: questions a cloud session is parked on (and what it said) come in, and answers picked in the dashboard go back out.

## TLDR

- The one surface meant to be reached from another origin, so every call must present a shared secret, checked before anything else is read.
- Payloads are tiny and validated field by field — no paths, no commands, no free text — so a stolen secret buys at worst a bogus question card.
- The extension can also ask which cloud sessions deserve a tab, fetch a session's queued answer, and report how delivering it went.
- With the feature off, everything answers "not found"; a daemon missing one piece degrades to "nothing" rather than an error.

## Rationales

- No cross-origin allowance is offered: the extension does not need one, and offering one would let any page the user visits reach their daemon.
- Transcript entries carry their position in the conversation, because the page is re-read constantly and the same message arrives many times.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
