A module-global read-through cache for the dashboard's slow reads (#1028) — chiefly `gh` PR lookups (~600ms vs ~10ms for git) that the polling UI would otherwise repeat every navigation and every ten seconds.

## TLDR

- `cachedRead(key, load, {ttlMs=60s, budgetMs=150ms})` returns `{value, pending}`; `invalidate(key)` / `clearCache()` drop entries.
- Three load-bearing behaviors: single flight (concurrent asks share one in-flight call), stale-while-revalidate (a known value answers immediately; refresh runs in the background once older than `ttlMs`), and a cold-ask budget (a first ask waits only `budgetMs` before reporting `pending`).
- `pending` means "on its way, ask again" — not "failed" and not "absent"; callers that must not act on a half-answer (e.g. offering to open a PR that may exist) use it to hold off.

## Decisions

- A failed load is never cached: the last good value stays (a panel keeps the PR it knew rather than blanking because gh hiccuped) and the next read retries.
- `Entry.has` distinguishes "no value yet" from a cached `undefined` value.
- In-flight rejections get a no-op `.catch` so only the awaiting caller ever sees them — never an unhandled rejection.
