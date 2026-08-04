A Manifest V3 Chrome extension bridging claude.ai and the local daemon: a question a Claude Code **cloud** session is parked on becomes a card in the dashboard, and the picked answer travels back into the claude.ai composer.

## TLDR

- Why it exists: a cloud run hands off and ends locally, so a later question is stranded on claude.ai with nothing streaming back.
- `content.js` (injected on claude.ai) extracts the awaiting-choices block and transcript from the page; `background.js` (service worker) POSTs them to the daemon's `/_bridge/*` routes with a bearer token, polls for queued answers, and manages one pinned background tab per watched session (the extension cannot know a cloud run started except by being told which sessions to open).
- Answer delivery is **tab-first, ack-second**: acking first would mark an answer sent that a dying tab never typed; the duplicate-delivery race is contained by a delivered-set plus the daemon's answer id.
- `check.mjs` is an offline jsdom harness covering the extraction and delivery cases; the extension lives deliberately **outside the pnpm workspace**.

## Decisions

- The token lives in the service worker / `chrome.storage.local`, never in the page — a content script shares the tab with claude.ai, and nothing on that page may read the daemon secret.
- Fetches happen in the worker because the daemon deliberately answers **no CORS headers**: a content-script fetch carries the page origin, while a worker with `host_permissions` (loopback only) is exempt.
- Delivery is constrained to a label the session itself offered, confirmed in the dashboard first, withdrawable until collected — the extension can never type free text.
- Transcript posting is diff-only (the mutation observer fires constantly; full resends would be hundreds of KB/s), and a MutationObserver is used over polling because Chrome throttles timers in hidden tabs to ~1/minute.

## Facts

- Hard-won extraction lessons are regression-covered: code blocks without `<pre>`, content behind shadow roots, brace-matching over guessed indentation, and the product's *own system prompt rendering on the page* as a decoy await-choices block. `main` is mirrored instead of `body` because `body` shipped the sidebar nav.
- Chrome can leave declared host permissions ungranted for unpacked extensions — a blocked worker fetch looks exactly like a bad token, so the options page checks `chrome.permissions.contains` first and uses `/_bridge/ping` to distinguish 401 (wrong token) from 404 (bridge off).
- The dismissed-sessions storage key is versioned because v1 poisoned itself (closing any claude.ai tab dismissed every watched session forever).

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
