Minimal static HTTP server for the harness: serves `index.html`, the package's compiled `dist/` (under `/dist/`), and the installed `@webcontainer/api` (under `/api/`) same-origin, with the cross-origin-isolation headers WebContainer requires.

## Facts

- Sets `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`, and `Cross-Origin-Resource-Policy: cross-origin` on every response — this is what makes `SharedArrayBuffer` (and thus WebContainer) available.
- Resolves `@webcontainer/api`'s dist directory via `import.meta.resolve` because the package is import-only (no CJS main).
- Listens on `127.0.0.1:0` (ephemeral port, resolved to the caller); `safeJoin` strips leading `..` sequences from request paths.
