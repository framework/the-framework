---
'@gemstack/the-framework': patch
---

The bridge no longer reports the protocol's own rendered examples as a question the session asked. Every Claude web session page opens with the run's prompt, which quotes the whole protocol — and two of its examples slipped the old decoy filter: the browser-handoff one (placeholders joined by punctuation in the title, literal labels) and the approval one (literal end to end). On a live page the dashboard rendered an answerable question card for a session that had asked nothing, one click away from typing into its real composer. The content script now discards everything rendered inside the transcript's opening message, catches placeholder-plus-punctuation titles, and matches the two literal examples verbatim; the extension and the daemon's expected version move to 0.8.1 together, so a not-yet-reloaded extension is refused loudly instead of continuing to report decoys.
