Tests for `serve-check.ts` against a REAL Docker container (`DockerRunner`) — the sandboxed boot-and-serve proof: install (a real `npm install`), start, in-container readiness probe, health fetch; plus the 5xx, exit-before-serving, and failing-install blocker paths.

## Facts

- The whole suite skips cleanly (`skip` message) when no Docker daemon is reachable, via top-level-await `dockerAvailable()`.
- `DockerRunner` publishes `previewPort` 3000 at boot, so both the app and `serveCheck` use the default 3000; the test server must bind `0.0.0.0` for the published port to reach it from the host.
