Chrome MV3 extension ("The Framework: Claude web bridge", #1237): reports the question a Claude Code cloud session is parked on to the local Framework daemon/dashboard, mirrors the session transcript, and — since v0.7.0 — types the answer picked in the dashboard back into the session's composer.

## TLDR

- `content.js` — page half: question/transcript extraction from claude.ai, answer typing, diagnostics panel.
- `background.js` — worker half: holds the token, all daemon fetches (`/_bridge/*`), dedupe, answer polling + acks, pinned-tab management.
- `options.html` / `options.js` — settings (token, daemon URL, auto-open) plus a connection test that names the exact failure mode.
- `check.mjs` — jsdom harness: 14 offline cases over `content.js`.
- `manifest.json` — MV3; `storage`/`tabs`/`alarms` permissions; `host_permissions` for localhost + 127.0.0.1; content script on `https://claude.ai/*`, `all_frames`, at `document_idle`.
- `README.md` — setup (bridge is off by default in The Framework; Site access must be granted manually) and the architecture rationale.

## Problems

- A cloud run hands off and ends, so when the session later asks something there is nothing streaming back and the question is stranded on claude.ai — this spike carries it home over the daemon's one cross-origin route.
- The daemon answers no CORS headers on purpose (a wildcard would let any site post to the dashboard), so every fetch must live in the service worker, which holds `host_permissions` and is exempt from CORS; the token lives there too, never in the page.

## Decisions

- Watch, don't poll: Chrome clamps timers in long-hidden tabs to ~once/min, and this is designed to run in pinned background tabs — a MutationObserver catches the session's own DOM changes immediately; intervals are only a backstop.
- The extension only ever types a label the session itself offered, the pick must be confirmed in the dashboard, and a queued pick can be withdrawn until collected.

## Facts

- After editing any file: reload the extension on `chrome://extensions` AND reload open claude.ai tabs — reloading the extension does not re-inject content scripts, and an orphaned script cannot hear the new worker; the panel shows the manifest version to tell stale from current.
- Host permissions declared in the manifest are not automatically granted for unpacked extensions; without the localhost grant the worker's fetch is blocked in-browser and looks exactly like a wrong token.
- Verify offline with `node check.mjs` (jsdom resolved through `packages/framework-dashboard`; the directory sits outside the workspace globs on purpose).
