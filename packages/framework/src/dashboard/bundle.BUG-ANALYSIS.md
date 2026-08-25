# Bug analysis: packages/framework/src/dashboard/bundle.ts

## Business logic (high-level)

Locates the built dashboard bundle: exactly one candidate, `<pkg>/dist/dashboard-bundle`, present only when its `index.html` is a real file; otherwise `undefined` so the caller serves the legacy fallback page. The single-path design is deliberate (A7): the two-package era's copy step and dual candidates are gone, so there is nothing to keep in sync.

The one subtlety is anchoring: the module resolves from *itself* (`import.meta.url`) up two levels to the package root, then down into `dist/dashboard-bundle`. Because this module can execute from `dist/`, `dist-test/`, or `src/` — all sitting exactly one level under the package root with the module one level below that (`<pkg>/{dist,dist-test,src}/dashboard/bundle.*`) — the arithmetic (`here/../..`) lands on the package root in all three cases, and the answer is the same directory regardless of which build is running. Verified against the actual repo layout (`packages/framework/{src,dist,dist-test}/dashboard/` all exist). If the directory layout ever changed depth, this would silently miss — but the comment states the invariant, and the layout is the package's own.

Failure modes: `stat` rejecting (missing file, permission), or `index.html` existing but not a regular file (directory, dangling entry) — both collapse to `false` via `.then(s => s.isFile()).catch(() => false)`, so the function never throws and never returns a directory whose entry page is unusable. `fileURLToPath` handles platform separators and percent-encoding in the module URL correctly.

## Functions (low-level)

- `resolveDashboardBundle(): Promise<string | undefined>` — inputs: none (module location + filesystem). Output: the bundle directory or `undefined`. Edge cases: no `dist/` at all (fresh checkout before build) → `stat` ENOENT → undefined; `index.html` as a directory → `isFile()` false → undefined; symlinked package root → `join` keeps the symlinked spelling, which is fine because the same spelling is later used to serve files. No async races (single stat), no resource held. Verdict: correct.

## Bugs found

None found.
