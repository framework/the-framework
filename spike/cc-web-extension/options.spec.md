The extension's options page logic: stores the daemon URL + bridge token in extension storage (so nothing on claude.ai can read the secret) and proves the connection end to end on save.

## TLDR

- Loads/saves `daemonUrl`, `token`, `autoOpen` via `chrome.storage.local`; auto-open defaults on once configured but is stored explicitly so the worker never guesses.
- "Save then prove it": after saving, checks host permissions, pings `/_bridge/ping` with the bearer token, and distinguishes every failure (401 wrong token, 404 bridge off, unreachable daemon).
- Also probes `/_bridge/sessions` so "connected" answers the next question too: is there anything to watch?
- An "Open now" button triggers the worker's tab sweep on demand (`tf-open-now` message) instead of waiting for the once-a-minute alarm, reporting exactly why nothing opened.

## Problems

- Manifest-declared host permissions are not the same as granted ones: Chrome's per-site toggles can sit off for an unpacked extension, and since the daemon sends no CORS headers by design, the worker's fetch dies in the browser looking like any other failure — so grants are checked first now.
- A 200 from the ping is not proof: the dashboard serves its SPA for unknown paths, so an old build answers 200 + HTML; the body must literally be `ok`.
