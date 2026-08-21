The daemon's doorway for the browser extension in the user's own claude.ai tab: questions a cloud session is parked on (and what it said) come in, and answers picked in the dashboard go back out.

## User Stories

- The user sees the question a cloud agent is parked on as an answerable card in the dashboard, reported by the extension in their own claude.ai tab.
- The user reads what the cloud session has said so far: its transcript follows along in the agent's view.
- The user's picked answer is fetched by the extension and typed into claude.ai, and the dashboard shows how the delivery went.
- The user is told when the extension and the daemon disagree on version, and how to fix it.

## Flows

- The one surface meant to be reached from another origin, so every call must present a shared secret, checked before anything else is read.
- Payloads are tiny and validated field by field — no paths, no commands, no free text — so a stolen secret buys at worst a bogus question card.
- What the session said comes in as transcript entries and feeds the transcript in the agent's view; a batch with one bad entry is refused whole, so a gap never masquerades as a message still on its way.
- The extension can also ask which cloud sessions deserve a tab, fetch a session's queued answer, and report how delivering it went.
- With the feature off, everything answers "not found". A daemon with no session list or no queued-answer source wired answers "nothing" — an empty list, a null — rather than an error.
- The extension states its version on every call, and a daemon expecting another refuses every route, naming both versions and the way out. A version-skewed extension half-works in ways that read as framework bugs, so there is no degraded mode; the expected version moves in lockstep with the extension's manifest.

## Rationales

- No cross-origin allowance is offered: the extension does not need one, and offering one would let any page the user visits reach their daemon.
- Transcript entries carry their position in the conversation, because the page is re-read constantly and the same message arrives many times.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
