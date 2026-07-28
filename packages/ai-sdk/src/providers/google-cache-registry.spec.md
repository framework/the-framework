Registry mapping stable cache keys to Google `cachedContents/*` resources for Gemini explicit prompt caching — dedups concurrent creates, memoizes "too-small" failures, and drops stale entries so the adapter can recreate on 404.

## TLDR

- `GoogleCacheRegistry.resolve(args)` returns the `cachedContents/*` resource name for a cache key, calling `client.caches.create` when missing; returns `null` when the prompt is below the model's minimum cacheable size.
- `forget(cacheKey)` drops an entry — used by `google/chat.ts` when `generateContent` 404s because the resource expired between create and use.
- Storage is pluggable: the AiProvider passes a framework `CacheAdapter` (`store`) for cross-process/restart persistence; otherwise an in-process `Map` is used with a one-time warning.
- Helpers: `buildGoogleCacheKey()` (cyrb53 hash over `{model}` + marked regions: system, tools, first-N contents), `splitContentsAtCache()` (cached vs fresh slices), `durationToGoogleTtl()` (duration string → `Ns` seconds format).

## Problems

- Concurrent same-key requests in one worker would race on `caches.create` — an in-flight promise map (`inFlight`) makes them share a single create.
- Prompts under the model minimum fail creation with INVALID_ARGUMENT — the failure is memoized as a `tooSmall` entry for 5 minutes (`TOO_SMALL_TTL_MS`) so a tight loop doesn't pound the create endpoint.
- Google cache resources are model-bound and expire server-side — the key embeds the model id, and expiry is tracked locally (`expiresAt`) so lookups self-clean.

## Decisions

- Any create error other than too-small falls back to uncached **for that request only** — no `tooSmall` entry is written, so the registry isn't poisoned by transient failures.
- `now` option is a test-only wall-clock override; `_internals` exports `isTooSmallError`/`isNotFoundError`/`parseDurationMs` for tests.

## Facts

- Store keys are prefixed `gemstack:ai:google-cache:`; created resources get `displayName: 'rudderjs:<cacheKey>'`.
- Default TTL is `'1h'`; duration parsing accepts `ms|s|m|h|d` suffixes and falls back to 1 hour on unparseable input.
- Too-small detection is string matching: message contains `minimum` plus `token` or `input`; not-found: status/code 404 or message contains `not found`/`404`.
- `buildGoogleCacheKey` returns `undefined` when no region is actually marked (parts contain only `{model}`), which disables caching for the call.
