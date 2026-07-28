The route as React state (#784): `useRoute()` returns the current `Route` parsed from Vike's `urlPathname` and a `go(next, {replace?})` that navigates via Vike's client router.

## Decisions

- Reads `urlPathname`, not `routeParams`: the shell is prerendered for `/` (ssr:false — one static index.html the daemon serves for every path), so baked-in params are build-time and never change, while `urlPathname` tracks the browser on both hard loads and client navigations. The catch-all `+route.ts` exists only so any path resolves to this page; nothing reads what it returns.
- Vike's router owning the URL makes Back/Forward free and a session a pasteable/reloadable link.
- `replace` maps to `overwriteLastHistoryEntry` — for corrections (adopting a started run's id), not steps you should be able to go Back to.
- Going where you already are is a no-op, not a history entry.
