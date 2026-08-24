# Bug analysis: packages/framework/dashboard/lib/profiles.ts

## Business logic (high-level)

Saved connection profiles (#1052): localStorage-backed device list (token is a per-browser secret — never sent to the daemon's registry, per SPEC), origin-keyed dedupe on save, the connect-hop URL carrying token + composer draft (#1066), the remembered loopback origin for "Local", the connected-indicator label, and a tiny notify store so the gear/indicator re-render on writes.

SPEC conformance:

- **Devices live in the browser, read defensively** — `store()` try/catches `globalThis.localStorage` (SSR, storage-disabled browsers); `listProfiles` try/catches JSON.parse and filters entries through `isProfile`. Malformed entries dropped, unreadable store → `[]`. Holds.
- **One entry per machine** — `addProfile` keys by `input.url` (the id), filters the old entry, prepends (newest first). All save paths go through `parseDeviceUrl`, which normalises to `u.origin`, so equal machines collide as intended (a caller passing a non-normalised url could duplicate, but no such caller exists). Holds.
- **A hop carries the typed prompt; an oversized draft is dropped** — `connectUrl` appends `draft=` only when `draft.length <= 7000`. The cap is measured in *characters before percent-encoding*, but what travels is the encoded form — up to 9× larger for non-ASCII (each 3-byte UTF-8 char becomes `%XX%XX%XX`). Probe: a 6000-char CJK draft (under the cap) encodes to a 54,000-char query — far past Node's default 16 KiB header budget (`http.maxHeaderSize` = 16384), so the destination daemon answers 431/closes and the *whole hop* fails, token included: exactly the "blow the URL" failure the cap exists to prevent, and worse than dropping the draft (SPEC: "an oversized draft is dropped rather than risking the URL … the hop proceeds as a plain connect"). Bug 1.
- **"Local" returns to the launch origin** — `rememberLocalOrigin` only stores when `isLoopbackHost(host)`; `localOrigin` falls back to `http://127.0.0.1:4200`. Holds.
- **Connected indicator** — loopback → `Local`; else saved label by exact `url === origin` match (both are normalised origins) or bare host. Holds.

Store mechanics: `snapshotCache` gives identity-stable snapshots between writes (required by `useSyncExternalStore`); `notify()` invalidates + fans out. Writes from *another tab* do not notify (no `storage` event listener) — same-browser two-tab staleness until reload; not covered by the SPEC, accepted.

## Functions (low-level)

- `store()` — try/catch getter; correct for jsdom/SSR/blocked-storage.
- `isProfile(v)` — structural string checks on all four fields; null-safe. Correct.
- `listProfiles()` — defensive parse + filter; non-array JSON → `[]`. Correct.
- `writeProfiles(list)` — `setItem` + notify. A quota-exceeded `setItem` throw would propagate to the caller (add/remove) uncaught — profiles are tiny, unreachable in practice; noted only.
- `addProfile(input)` — label falls back to `hostLabel` (URL host, or the raw string for an unparseable url); trims a given label and treats an all-whitespace label as absent (`||`). Returns the stored profile. Correct.
- `removeProfile(id)` — filter by id. Correct.
- `hostLabel(url)` — try/catch `new URL`. Correct.
- `parseDeviceUrl(pasted)` — trims, `new URL`, returns `{origin, token ?? ''}`; non-URL → null. `u.origin` drops path/query as intended. Correct.
- `rememberLocalOrigin` / `localOrigin` — loopback-gated remember; default fallback. Correct.
- `connectUrl(profile, draft)` — token always first when present; draft appended under the character cap; bare `profile.url` when neither. Bug 1 (cap unit) applies here.
- `connectTo` / `connectLocal` — `globalThis.location?.assign(...)`; optional-chained for non-browser. Correct.
- `currentConnection(profiles, origin, host)` — see above. Correct.
- `useConnectionProfiles()` — subscribe/getSnapshot/EMPTY server snapshot. Correct.

## Bugs found

1. `L119` (`connectUrl`, with `MAX_CARRIED_DRAFT` at L111): the draft size cap counts pre-encoding characters, but the URL carries `encodeURIComponent(draft)` — up to 9× longer for non-ASCII text. A CJK/emoji draft of roughly 1,800–7,000 characters passes the cap yet produces a query far beyond the destination daemon's default request-header budget (Node's `http.maxHeaderSize` is 16 KiB), so the daemon rejects the request (431) and the device hop fails outright — instead of the intended degrade-to-plain-connect. Trigger: type a few thousand CJK characters in the composer, switch device. Contradicts the SPEC ("an outsized paste cannot break the URL"; the hop should proceed as a plain connect). Severity: minor. Confidence: medium (depends on the destination daemon's header limit, which is Node's default). Fix: encode first and cap the encoded length — `const enc = draft && encodeURIComponent(draft); if (enc && enc.length <= MAX_CARRIED_DRAFT) parts.push('draft=' + enc)`.
