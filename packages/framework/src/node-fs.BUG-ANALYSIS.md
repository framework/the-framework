# Bug analysis: packages/framework/src/node-fs.ts

## Business logic (high-level)

The single shared `node:fs/promises` adapter behind every `node*Fs()` factory: read (rejects when absent), write/append (utf8), exists/isDirectory (any stat error reads as false), mkdir (recursive), readdir (missing dir yields `[]`), rename (atomic replace within a filesystem), chmod (propagates errors). Two invariants: (1) the semantic contract in `node-fs.SPEC.md`, and (2) the import-graph convention — every `node:fs` import is *dynamic* so browser-safe modules can keep this in their static graph (enforced elsewhere by `client.test.ts`).

Checked against the SPEC line by line:

- "creating a directory also creates its parents" — `mkdir(path, {recursive: true})`. Matches.
- "listing a directory that does not exist yields nothing" — catch-all `[]`; the SPEC's follow-up "a missing **or unreadable** path is never an error" covers the catch-all breadth (EACCES, ENOTDIR also read as empty). Matches.
- "asking whether a path is a file or a directory answers no for anything that cannot be inspected" — try/catch false on both. Note `exists` is documented (interface comment) as "exists AND is a file": a *directory* answers false to `exists`, which is the contract callers rely on (e.g. layout/marker checks want files). Matches its doc.
- "reading a file that is absent does fail" — no catch on `read`. Matches.
- "replacing one file with another happens in a single step" — `rename` passes through to POSIX rename; atomic on one filesystem, and the interface comment says exactly that scope. Matches.
- "permission bits can be set" — chmod propagates errors (documented: rejects when absent or unexpressable). Matches.

Edge cases: `stat` follows symlinks, so a symlink to a file answers `exists=true` — reasonable for every caller (they read through the link anyway). `readdir` returns names only (no `withFileTypes`), per the interface comment. `writeFile`/`appendFile` with utf8: no binary use anywhere in consumers of `NodeFs`. Concurrency: the adapter adds no locking, by design — serialization lives in callers (e.g. the data-branch funnel). Dynamic `import()` per call has negligible cost (module cache) and preserves the browser-safety invariant.

## Functions (low-level)

- **`nodeFs()`** — returns a fresh object each call; stateless, so multiple instances are interchangeable. Each method one-lines to the corresponding `fs/promises` call with the documented error policy. `exists`/`isDirectory` swallow only stat errors (returning false), never write errors; `rename`/`chmod`/`write`/`append`/`read` propagate — no swallowed rejection anywhere a caller needs to see. Verdict: correct.

## Bugs found

None found.
