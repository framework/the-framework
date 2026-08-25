# Bug analysis: packages/framework/src/dashboard/static.ts

## Business logic (high-level)

Serves the built Vite SPA (`index.html` + hashed `assets/**`) with an app-shell fallback, per `static.SPEC.md`:

- **App-shell fallback**: any path naming no real file inside the bundle answers `index.html`.
- **Containment**: a decoded path is joined to the bundle root, normalized, and must equal the root or start with `root + sep`; anything else (traversal) falls back to the shell rather than reading outside. Verified against `..`, encoded `%2e%2e%2f` (decoded once then normalized away), double-encoding (stays literal, names no file), and null bytes (`stat` rejects → treated as absent).
- **Never throws**: this function is `void`-dispatched by server.ts, so a rejection would kill the daemon (#938). Every await is caught: `stat` → false, `readFile` → undefined (→ 404 "bundle not built"), pathname parse and percent-decode wrapped (`requestPathname` returns undefined → `/`; `tryDecode` returns `''` → shell). I found no reachable rejection path; `res.writeHead`/`res.end` on a normally-open response do not throw.
- **Caching**: `index.html` → `no-cache`; everything else → `immutable` 1y. In this bundle only hashed `assets/**` exist beside `index.html` (no Vite `public/` dir in `packages/framework/dashboard`), so the immutable rule cannot mis-cache an unhashed file today. If an unhashed top-level file (favicon, robots.txt) is ever added to the bundle, it would be cached immutably across upgrades — reliance noted, not a current bug.

Edge cases and one latent reliance:

- **Trailing slash on `dir`**: probed — `normalize('/a/b/')` keeps the trailing slash, so `candidate.startsWith(root + sep)` would be false for *every* file and the server would serve the shell for all assets (JS served as HTML). Unreachable today: `resolveDashboardBundle` and the tests produce slash-less paths (join/mkdtemp). Reliance on callers, not a bug.
- **Directory paths** (`/assets`): `isFile` → false → shell. Correct.
- **Empty `rel`** (`/` or a malformed escape): the `rel &&` guard routes straight to the shell. Correct.
- **Symlinks inside the bundle**: `stat` follows them; the bundle is package-controlled content, so no attacker can plant one.

## Functions (low-level)

- **`isFile(path)`** — `stat().isFile()` with every failure → false. Correct.
- **`tryDecode(pathname)`** — `decodeURIComponent` with malformed escapes → `''` (which then serves the shell; the "names no file" comment matches). Correct.
- **`serveClientBundle(req, res, dir)`** — described above. The 404 "dashboard bundle not built" branch triggers only when even `index.html` is unreadable, matching the SPEC's "A missing bundle says so". Content type via `contentTypeFor(target)` (pure lookup). Verdict: correct.

## Bugs found

None found.
