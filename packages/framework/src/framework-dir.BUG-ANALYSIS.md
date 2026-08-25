# Bug analysis: packages/framework/src/framework-dir.ts

## Business logic (high-level)

One exported constant, `THE_FRAMEWORK_DIR = '.the-framework'`, split into its own module solely so browser-side code (dashboard preset paths, #874/#520) can import it without dragging in `node:path` via `logs.ts`. Matches `framework-dir.SPEC.md` verbatim. The module imports nothing, so the browser-safety invariant (no node-only imports) holds. The value agrees with the checked-in layout marker (`framework-dir: .the-framework` in `/home/user/the-framework/.the-framework/LAYOUT`), so the layout gate's derivation is consistent.

## Functions (low-level)

- **`THE_FRAMEWORK_DIR`** — string constant. No edge cases; every consumer joins it under a project root. Verdict: correct.

## Bugs found

None found.
