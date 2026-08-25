# Bug analysis: packages/framework/src/project-presets.test.ts

## Business logic (high-level)

Covers `project-presets.test.SPEC.md` clause by clause: missing-file read → `[]`; malformed-JSON read → `[]`; write/read round-trip; sanitize-on-write (trim, drop empty id / empty prompt / duplicate id); the gitignore negation added on save; the negation added only once across saves; an empty list still writing `[]\n` and keeping the negation.

The `memFs` fake mirrors the node `StoreFs` contract where it matters: `read` **throws** on a missing path (stated in its doc comment), which is what exercises `readProjectPresets`'s catch branch and `ensureGitignoreNegation`'s no-gitignore branch. `mkdir` is a no-op (memory fs has no dirs) — acceptable since nothing under test depends on directory existence.

Do the tests verify what they claim?

- Round-trip test compares the full array via `deepEqual` — a lost field, extra trim, or dropped entry fails. Correct.
- Sanitize test feeds four entries (`as never` for the type-invalid ones) and asserts exactly the one survivor with trimmed fields. This pins the shared `sanitizeCustomPresets` behavior through the project-tier entry point. Correct.
- Negation tests seed a realistic install-written gitignore (`*`/`!.gitignore`/`!LOGS.md`) and assert exact-line membership / count — so a doubled append or a missed append fails. Note the test checks *line presence*, not position; position matters for gitignore semantics (negation must follow `*`), but the implementation appends, so order is guaranteed by construction. Acceptable.
- Empty-list test asserts the literal file content `'[]\n'` — pins the keep-the-file rule.

Gap (noted, not a bug): no test covers saving when **no** `.the-framework/.gitignore` exists (the pre-install branch), which is exactly where the source file's questionable bare-negation behavior lives (see `project-presets.BUG-ANALYSIS.md`). A test would have documented the intended interaction with the activation marker.

## Functions (low-level)

- **`memFs(seed?)`** — Map-backed `StoreFs` with `files` exposed for assertions; `append` unused here; `exists` keyed on the map. Faithful enough. Correct.
- **`GITIGNORE` / `PRESETS` consts** — built with `join('/repo', ...)`, matching the implementation's `join(cwd, ...)` exactly (same separator on the test platform). Correct.
- All tests await every async call; assertions run after. No unawaited promises, no vacuous assertions.

## Bugs found

None found.
