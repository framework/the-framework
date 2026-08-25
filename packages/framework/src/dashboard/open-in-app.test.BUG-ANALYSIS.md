# Bug analysis: packages/framework/src/dashboard/open-in-app.test.ts

## Business logic (high-level)

Covers exactly what its test SPEC claims: per-OS reveal command selection; editor default/override resolution (`code`, whitespace-only → `code`, explicit value honored); a successful open reports ok and targets the requested folder; ENOENT maps to a readable "not found" message; the #727 preference is passed through to the spawn; detection keeps only probed-installed editors in catalog order and yields `[]` when none are installed.

All spawn behavior is exercised through the injected `SpawnRunner` seam, so no real process is launched — deliberate and appropriate for unit tests, but it means the platform-specific spawn semantics (detached spawn resolving on launch; Windows `.cmd` EINVAL — the bug recorded against open-in-app.ts) are untested by design. `nodeEditorProbe`/`nodeSpawnRunner` themselves are unexported and uncovered; noted as a coverage gap only.

## Functions (low-level)

- **Test "fileManagerCommand picks the OS reveal command"** — asserts all three platforms with explicit `os` argument, no reliance on the host OS. Correct.
- **Test "editorCommand defaults to code, honoring $FRAMEWORK_EDITOR"** — passes the editor argument explicitly (`undefined`, `'  '`, `'subl'`), so the ambient `process.env.FRAMEWORK_EDITOR` default parameter is bypassed — the test cannot be broken by the host env, but also never proves the env fallback itself; the name over-promises slightly (env fallback is only reachable through the default parameter). Assertions correct; can fail.
- **Test "openInApp returns ok on a successful spawn…"** — records calls, asserts one call and the path as argv[0]'s argument. Correct.
- **Test "openInApp reports a friendly error when the command is missing"** — fake runner throws an ENOENT-coded error; asserts `ok: false` and matches `/not be found|not found/i` against "was not found on PATH". Regex matches; can fail if the mapping breaks. Correct.
- **Test "opens the editor with the passed-in preference (#727)"** — asserts `{ command: 'zed', args: ['/repo'] }`. Correct.
- **Test "detectEditors keeps only the probed-installed editors…"** — compares against a filter of `KNOWN_EDITORS`, so it survives catalog edits; also asserts the empty case. Note: by deriving the expectation from `KNOWN_EDITORS` itself, catalog *order* is asserted only relative to the same source — it cannot catch a wrongly ordered catalog, only a detection that reorders. Acceptable. Correct.

## Bugs found

None found.
