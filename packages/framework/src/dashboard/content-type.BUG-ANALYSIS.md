# Bug analysis: packages/framework/src/dashboard/content-type.ts

## Business logic (high-level)

One shared extension→content-type table for the framework's two static servers (dashboard bundle in static.ts, project Preview in preview.ts), created precisely because the two private copies had drifted (each missing entries the other had). Policy stays with the servers; only the lookup is shared. Unknown extensions fall back to `application/octet-stream`, which is the safe default (browsers download rather than sniff-execute).

Table review: the charset-bearing text types (`html`, `js`, `mjs`, `css`, `json`, `map`, `webmanifest`) and the binary image/font types are all standard and correctly spelled (`text/javascript` is the current standard registration; `image/svg+xml` without charset is fine; `.map` as JSON is conventional). Everything a Vite bundle emits (`js`, `css`, `map`, `woff2`, `svg`, `ico`, images, `webmanifest`) is present.

## Functions (low-level)

- `contentTypeFor(path)` — `extname(path).toLowerCase()` then table lookup with octet-stream fallback. Edge cases: no extension (`extname` → `''`) → fallback; dotfile like `.gitignore` (`extname` → `''`) → fallback; uppercase extensions (`LOGO.PNG`) → lowered → matched; trailing dot (`file.`) → `''` → fallback; query strings never reach this (callers pass filesystem paths, not URLs — and both servers resolve pathnames first). Prototype-pollution style keys (`path = 'x.constructor'`) are safe: `extname` yields `.constructor`, and `CONTENT_TYPES['.constructor']` is `undefined` because the object's own keys are all dot-prefixed extensions and inherited properties would need the exact key — `Record` literal lookups of `'.constructor'` miss (only `'constructor'` would hit `Object.prototype`, and a leading dot prevents that). Verified reasoning: `extname` always includes the leading dot for a non-empty extension, so no bare `constructor`/`__proto__` key can be produced. Verdict: correct.

## Bugs found

None found.
