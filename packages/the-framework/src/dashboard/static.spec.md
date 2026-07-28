Serves the prerendered dashboard bundle (#405): plain files with an SPA fallback — any non-asset path yields `index.html`, which boots the client router; no Vike runtime in the daemon.

## Decisions

- Path traversal is guarded by normalize + prefix check; an escaping request falls back to `index.html` rather than reading outside the bundle.
- Unparseable request targets and malformed percent-escapes (`/%zz`) must not throw: this runs void-dispatched, and an exception would be an unhandled rejection taking the daemon down (#938) — both fall back to the SPA shell.
- Cache policy: fingerprinted assets are `immutable, max-age=1y`; `index.html` is `no-cache` (always revalidates).

## Facts

- Assets are copied into the framework package at build time by `scripts/bundle-dashboard.mjs`; a missing bundle answers 404 "dashboard bundle not built".
