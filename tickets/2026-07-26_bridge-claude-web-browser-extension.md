Status: open
Priority: 5
Topics: [enhancement, the-framework, ux]
GitHub: [#1237](https://github.com/gemstack-land/the-framework/issues/1237)

# Bridge a Claude web session into the dashboard with a browser extension

## TLDR

Show a parked cloud session's question in the dashboard and let the user answer it there, via a browser extension running in the user's own logged-in claude.ai session — avoiding the private session API's two blockers (undocumented, and it authenticates with the user's subscription credential, against the #495 posture). Thread state: **built end to end** on branch `feat/1237-bridge-question` (draft PR #1238, extension v0.7.0). Proven live: DOM extraction of the await-choices question (shadow-DOM-aware, brace-matching, rejects our own protocol spec rendered in the page), narrow `/_bridge/*` daemon endpoints (own bearer token, no CORS, opt-in preference, off by default), the question rendered as real choices in the dashboard (pick + explicit confirm, withdrawable until collected), the answer typed into the composer and submitted by the extension (30s alarm poll), transcript tail-mirroring, and auto-opened pinned background tabs (capped at 3, 12h back). The join key is `RunMeta.sessionId` (`session_01...`), so the question renders on the finished run's page — nothing about #1231 needs undoing.

## Why it matters

This completes the CC web target's interaction story (#1234 is the stopgap for unanswerable gates; #1235's teleport route is dead): questions become visible and answerable from the dashboard, keeping cloud runs from being spent for nothing. What's left is mostly review-and-decide rather than build: `/_bridge` is the first route deliberately reachable from outside the dashboard's origin on a daemon that spawns processes (wants review, not momentum), the extension acting for the user (auto-opening hidden tabs, submitting picks) is a deliberate choice, Chrome must be running for the bridge to work, and it's a new distribution surface (store listing/sideload, maintenance against an unversioned UI).

## Source

Imported from GitHub issue [gemstack-land/the-framework#1237](https://github.com/gemstack-land/the-framework/issues/1237), created 2026-07-26, labels: `enhancement`, `priority: medium`, `the-framework ♻️`, `UX ✨`, 6 comments.

### Original description

Show a cloud session's question in the dashboard, and let the user answer it there, using a browser extension running in the user's own logged in Claude session.

This is the interaction story #1235 is missing. #1234 stops a cloud run deadlocking on a question nobody can answer; this is the other half, letting it ask.

## Why an extension and not the API

There is a session API, and it does exactly what we want. Found by reading the shipped CLI binary (2.1.220):

| | endpoint |
|---|---|
| stream | `GET /v1/code/sessions/{id}/events/stream`, SSE, resumable via `from_sequence_num` |
| history | `GET /v1/code/sessions/{id}/events?limit=&sort_order=desc` |
| write | `POST /v1/code/sessions/{id}/events` with `{ session_id, events: [{ payload }] }` |

Two things rule it out for now. It is private and undocumented, so it can break on any CLI update. And it authenticates with the user's subscription credential, which would mean the framework holding that credential rather than the CLI holding its own, which is the posture we chose deliberately in #495.

The CLI will not lend us the API either, which was the hope:

- `--attach`, `--follow` and `--watch` are not Claude Code flags. They are strings from bundled dependencies. A control test with a nonsense flag is what exposed this; a `--help` based check wrongly suggests they are accepted, because `--help` short circuits option validation.
- `--teleport` is interactive only, and it does not refuse when it cannot work. Under `-p` it is **silently ignored** and a fresh local session runs instead. Confirmed twice, including under a pty, which is the trick that made `--cloud` work; the pty does not help because `-p` itself is the disqualifier. It cost 0.099 USD and 26 turns to find this out, which is worth knowing on its own: anything that shells out `--teleport` with `-p` will quietly do local work and bill for it.

An extension avoids the credential problem entirely. It runs in the user's own browser, in a session they are already signed into, with them present.

## What the spike found

Branch `spike/cc-web-extension`, directory `spike/cc-web-extension/`. It lives outside `packages/` and `examples/`, which the pnpm workspace globs do not match, so it joins no build.

It requests **no host permissions** and sends nothing anywhere. It answers only the readable half: can it find the question, and the box an answer would go into. Load it unpacked and open a parked session; the README says what a passing result looks like.

**Transport is already known to be a problem, and it is not the obvious one.** The daemon's CSRF guard rejects an extension outright. Measured against a running daemon:

```
Origin: chrome-extension://abc   -> 403
Origin: http://localhost:4200    -> 200
no Origin header                 -> 200
```

A content script on claude.ai sends `Origin: https://claude.ai`, and a service worker sends `Origin: chrome-extension://<id>`; both are refused. So `/_telefunc` cannot be reused. This needs a dedicated ingest endpoint with its own token, deliberately narrow, since the daemon spawns processes and the shared token is its only guard.

## Design sketch

1. Content script watches a `claude.ai/code/*` page and extracts the await-choices block.
2. It posts to a new narrow daemon endpoint, with a token the user pastes in once.
3. The dashboard renders it as an ordinary choice card, since the shape is the one the choice UI already takes.
4. The user's pick goes back the same way, and the extension types it into the composer and submits.

Steps 1 to 3 are the read half and are worth building alone: the question becoming visible in the dashboard is most of the value. Step 4 is the half that has the extension act rather than observe, and it should be a separate decision.

## Open questions

1. **Is DOM extraction stable enough?** The spike answers this. If the question cannot be found while plainly on screen, this approach is the wrong bet and the API route is the honest one.
2. **A tab has to stay open.** A cloud run is meant to be hand off and forget; requiring a live tab for its duration takes back much of that. Is that acceptable, or does it only make sense for runs the user is already watching?
3. **Read only, or also write?** Observing the user's own session and relaying it is a different thing from typing on their behalf. Worth deciding explicitly rather than by default.
4. **Is this the right surface at all?** It is a new distribution channel: host permissions on claude.ai, an install prompt, either a store listing or sideload instructions, and maintenance against a UI that changes without notice. That is a lot to carry for one feature.

## Related

#1234, #1235, #610, #495 for the credential posture, #1051 for the daemon token.

### Notes from the GitHub thread

- All four original open questions got answered by building it: DOM extraction is viable (proven on a live session; needed shadow-DOM walking, brace-matching instead of fixed prefixes, and rejecting our own system prompt rendered in the page as a decoy); writing works (the React contenteditable accepts the fill); the tab must *exist* but not be visible — the extension opens pinned background tabs itself (`active: false, pinned: true`), so the bridge works invisibly while Chrome runs (background timer throttling → `MutationObserver` + `chrome.alarms`; discarded tabs are revived; a run finishing with Chrome shut is not bridged).
- Built (draft PR #1238, v0.7.0): `/_bridge/*` (`ping`, `question`, `events`, `sessions`, `hello`, `answer`, `answered`) guarded by its own bearer token, off by default behind the `bridge` preference; Settings gained a "Claude web" section (toggle + token). The store only queues a label of the currently parked question (never free text), ignores re-reports, refuses stale acks, drops undelivered picks if the session moves on. Transcript mirror = one tail block honestly labelled as a mirror (per-message structure decided against: `article` finds nothing and heuristics would post gibberish).
- Regression harness `spike/cc-web-extension/check.mjs` (13 cases, no browser needed). Suites at last report: the-framework 1440 pass, framework-dashboard 601 pass.
- Dev traps recorded in-thread worth keeping: `pnpm build` caches `bundle:dashboard` (run it explicitly + restart); reloading the extension doesn't re-inject content scripts (reload the tab too); bump the manifest version every change; `/_bridge/hello` reports the injected script's version/last-scrape; the SPA answers 200 HTML for unknown paths (check ping body, not status); dashboard components importing telefunc modules need `vi.mock` in tests.
- #1234 is handled in a separate PR: #1250.
