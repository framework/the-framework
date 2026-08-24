# Bug analysis: packages/framework/dashboard/lib/profiles.test.ts

## Business logic (high-level)

Round-trips the #1052 profile store through jsdom's real localStorage: add/list/remove with newest-first ordering and host-fallback labels, origin-keyed dedupe on re-add, storage persistence, `parseDeviceUrl` extraction (trim, path/query stripping, missing token, non-URL), `connectUrl` token/draft composition including the oversize-draft drop, `connectTo` navigation (stubbed `location`), the connected-indicator labels, and the loopback-origin memory. Each claim is genuinely asserted against observable output; `afterEach(localStorage.clear)` isolates tests.

Notable: the oversize-draft test uses `'x'.repeat(8000)` — ASCII, over the 7000-character cap — so it verifies the drop happens, but no test covers a multibyte draft *under* the character cap whose encoded form is oversized (the gap behind the bug filed against `connectUrl` in `profiles.BUG-ANALYSIS.md`). A coverage gap, not a wrong assertion.

## Functions (low-level)

- "add / list / remove round-trips" — order `['box…', 'Studio']` pins newest-first; `b.label` pins host fallback; removal by id. Correct.
- "re-adding the same origin refreshes" — length 1 + token `new`. Correct.
- "profiles survive a reload" — reads `fw.devices` straight from storage, bypassing the module's snapshot cache; proves persistence rather than cache echo. Correct.
- "parseDeviceUrl pulls the origin and token" — four shapes incl. trimmed input, path+query, tokenless, and non-URL → null. Correct.
- "connectUrl carries the token" / "carries the composer draft" — token-only, token+draft, draft-only (Local), and the ASCII oversize drop. Correct.
- "connectTo navigates" — `vi.stubGlobal('location', {assign})` (jsdom will not let `location.assign` be redefined, so the whole object the code reads through `globalThis.location` is swapped); asserts one call carrying token and encoded draft; `vi.unstubAllGlobals()` restores. If an assertion between stub and unstub threw, the stub would leak into later tests — cosmetic risk only, and the later tests don't touch `location`. Correct.
- "currentConnection labels" — Local / saved label / bare-host fallback. Correct.
- "localOrigin returns the remembered loopback origin" — default first, remembered second, non-loopback ignored third; order-sensitive within the test (deliberate sequence). Correct.

## Bugs found

None found. (Coverage gap: no multibyte-draft case for `connectUrl`'s cap — see the source file's analysis.)
