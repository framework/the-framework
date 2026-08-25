# Bug analysis: packages/framework/src/config.test.ts

## Business logic (high-level)

Tests for `the-framework.yml` parsing and loading, matching `config.test.SPEC.md` section by section: what it reads (both mode booleans, individually and together; every `handoff` rung form asserted via `local` and `merge`; empty/comment-only documents; a real directory read; a directory with no file), what it refuses (non-map documents; non-boolean mode values; `handoff` rungs that do not exist, including the boolean spelling `true` — refused *by name*, with the full rung list in the message), the zero-migration stance (all retired keys — the three publish booleans, `antiLazyPill`, `preset`/`event` — parse to `{}`), and the failure-is-a-warning contract (malformed file → `{}` plus a warning matching `ignoring the-framework\.yml`).

The tests assert exact result objects (`deepEqual`) and exact error-message fragments (`assert.throws` with regex), so they verify what they claim. The `loadFrameworkConfig` tests use real temp directories with cleanup in `finally`.

Coverage note (ties to the bug filed against config.ts): the "warns and returns {} on a malformed file" test seeds a *validation* error (`vanilla: 3`), whose message is prefixed with the file name by `parseFrameworkConfig` itself. A YAML *syntax* error takes the same code path but produces a warning with no file name — the test-SPEC's "reported as an ignored file, naming it" is therefore only half-pinned, and the untested half is where the production gap sits. A second seed like `writeFile(..., 'foo: [')` with the same `ignoring the-framework\.yml` assertion would have caught it. This is a coverage gap in service of a real bug (recorded on config.ts), not a wrong test.

## Functions (low-level)

- `reads the mode booleans together` / `vanilla toggle` / `transparent toggle` — parse the true case and refuse a string value with the key named. Match implementation and SPEC. Correct.
- `reads the handoff rung` — `local` and `merge` parse; `publish` and `true` are refused with `"handoff" must be one of local | push | pr | merge` (regex-escaped pipes). Matches `HANDOFF_LEVELS` order. Correct.
- `reads only the current spellings` — five retired keys/pairs each yield `{}`; documents the zero-users/no-migration decision in comments. Correct.
- `treats an empty document as {}` — empty string and comment-only document. Correct.
- `rejects a non-map document and mistyped fields` — a sequence document → `must be a YAML map`; `transparent: yep` → boolean error (also demonstrates YAML 1.2 not coercing `yep`). A scalar document (e.g. `just text`) is untested but the same guard covers it. Correct.
- `loadFrameworkConfig reads the-framework.yml from a directory` — writes a two-key file, expects exactly those keys. Correct.
- `yields {} when no config file is present` — empty temp dir. Correct.
- `warns and returns {} on a malformed file` — `vanilla: 3`, expects `{}` and a warning matching `ignoring the-framework\.yml`. Passes today because the validation error carries the prefix; see coverage note above. Correct as far as it goes.

Untested but implemented behavior (noted, not bugs): the `.yaml` fallback spelling and the `.yml`-shadows-`.yaml` precedence have no test; `parseFrameworkConfig`'s custom `source` label is only exercised implicitly.

## Bugs found

None found. (The syntax-error warning gap is recorded against `config.ts` L77, where the fix belongs; the corresponding missing test case here is a coverage gap, not a faulty test.)
