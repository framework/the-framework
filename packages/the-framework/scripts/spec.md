Build/CI scripts for the `@gemstack/the-framework` package.

## TLDR

- `gen-prompts.mjs` — compiles `prompts/**/*.md` into `src/prompts.generated.ts` string constants (#551); runs before build/test/typecheck so prompts stay browser-importable (#520).
- `check-prompt-drift.mjs` — fails CI when `prompts/` drifts from issue #326 (the prompt's source of truth); uses `op-326-on-before-mergeable.snapshot.md` as the reviewed snapshot of the block that cannot ship verbatim.
- `bundle-dashboard.mjs` — copies the prerendered framework-dashboard client bundle into this package's dist for publishing (#405); skips gracefully when absent.
- `run-tests.mjs` — the package's test runner (invoked by `pnpm test` after tsc).
