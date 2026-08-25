# Bug analysis: packages/framework/src/dashboard/discord-webhook.ts

## Business logic (high-level)

The single Discord *webhook* transport (#627): one POST of one message, shared by both notification posters (activity, interventions) so the fetch is not per-feed. Two duties:

- **Clamp to Discord's 2000-character limit with a visible marker (#940)** — Discord rejects an over-long message outright, so an unclamped "needs you" batch silently posted nothing. `clampContent` cuts to exactly `MAX_CONTENT` including the `\n… (truncated)` notice, so a cut message never reads as complete.
- **Never throw out of a daemon watcher** — a non-ok HTTP response and a network error both resolve `false` for the caller to log; only the boolean travels.

Unicode notes (analysed, not bugs): `.length`/`.slice` count UTF-16 units while Discord counts characters, so the clamp is *conservative* (a string of ≤2000 UTF-16 units has ≤2000 characters) — safe direction, never a rejected post. A cut landing inside a surrogate pair (an emoji at position 1985 of a long batch) leaves a lone surrogate; `JSON.stringify` escapes it and undici's UTF-8 encoding turns it into U+FFFD — one replacement glyph immediately before the truncation marker, cosmetic only, delivery unaffected. Not worth code.

Failure containment reviewed: the `try` wraps the fetch *and* body construction; `res.ok` (2xx) is the delivery verdict — Discord webhooks answer 204 (or 200 with `?wait=true`), both ok; 4xx/5xx read as not delivered. Rate limiting (429) therefore reads as "not delivered", which is the honest answer for a fire-and-forget transport; no retry is attempted, matching the project's simple-code stance — callers treat delivery as best-effort and log.

No headers beyond `Content-Type` are needed (webhooks are token-in-URL). The webhook URL itself is caller-supplied configuration; nothing here logs it, so no secret leakage path.

## Functions (low-level)

- `MAX_CONTENT = 2000` — exported so the tests and callers share the constant. Correct.
- `clampContent(text)` — pass-through at ≤2000; else slice to `2000 - notice.length` plus notice → exactly 2000. Off-by-one checked: 2001 input → 1986 kept + 14 notice = 2000. Empty notice interplay: none. Verdict: correct.
- `postDiscordWebhook(webhook, content, fetchImpl)` — POSTs `{content: clamped}` as JSON; returns `res.ok`; catch-all → false. `fetchImpl` injectable for tests. Edge cases: an aborting/timing-out fetch rejects → false (no unhandled rejection); a webhook URL that is not a URL → fetch throws synchronously inside the async function → caught → false. Verdict: correct.

## Bugs found

None found.
