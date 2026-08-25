# Bug analysis: packages/framework/src/config.ts

## Business logic (high-level)

Reads and validates the repo-committed `the-framework.yml` / `the-framework.yaml`: three settings (`vanilla`, `transparent`, `handoff`), only what the file names, `.yml` before `.yaml`, first existing spelling wins. Per `config.SPEC.md`: a missing file is no configuration; a malformed file warns and is treated as empty (never fails an agent); `handoff` is validated by value against the real rungs so a typo or a leftover `handoff: true` errors instead of silently publishing more than the file says; unknown keys (all the retired spellings) are ignored with no migration path (MEMORY.md: zero migration code).

Invariants checked:

- **Precedence/`.yml` first**: the loop over `FRAMEWORK_CONFIG_FILES` reads `.yml` first and only falls to `.yaml` when the read itself fails. A malformed-but-present `.yml` is "the one used" (warn + `{}`), not skipped in favor of `.yaml` — matches the SPEC's "the first one that exists is the one used".
- **Validation is per-value for the enum, per-type for the booleans**: `isHandoffLevel` checks membership in `local|push|pr|merge`; booleans must be `typeof boolean` (so YAML 1.1 spellings like `yes` arrive as strings and are refused, which the tests pin via `nope`/`yep`).
- **Non-map documents refused**: `null`/empty → `{}`; arrays and scalars (string/number/boolean documents) → thrown error naming the source.
- **Best-effort read**: any `readFile` failure (ENOENT, but also EISDIR/EACCES) is treated as "not this name". A present-but-unreadable file therefore yields `{}` silently, without the warning the TL;DR's "unreadable … is reported" wording suggests — callers essentially never produce this (a directory named `the-framework.yml`, a permission-denied config), so recorded as a reliance, not reported.

One genuine gap found in the warn path, see Bugs.

## Functions (low-level)

- `FrameworkFileConfig` — three optional fields; doc comments carry the C3 rename history and the `merge`-must-be-asked-for rationale. Matches `config-layers`' consumption via `CONFIG_KEYS`. Correct.
- `FRAMEWORK_CONFIG_FILES` — `['the-framework.yml', 'the-framework.yaml']`, precedence order per spec. Correct.
- `ENUM_CONFIG_KEYS` / `BOOLEAN_CONFIG_KEYS` / `CONFIG_KEYS` — the canonical key lists; `CONFIG_KEYS` = enum then booleans. `config-layers.fileConfigLayer` iterates `CONFIG_KEYS`, so the lists agree by construction. Correct.
- `loadFrameworkConfig(dir, onWarn)` — per name: read (failure → next name), parse (throw → warn `ignoring <message>` and return `{}`). Returns `{}` when no name matched. The inline comment claims "parseFrameworkConfig already prefixes the file name in its message", which is only true for the validation errors it constructs itself — a YAML *syntax* error thrown by `parseYaml` carries no file name (probed: `yaml`'s message is e.g. `Flow sequence in block collection must be sufficiently indented … at line 1, column 7` plus a code frame). See bug 1.
- `parseFrameworkConfig(raw, source)` — `parseYaml` (throws on syntax errors); `null` → `{}`; non-object/array → `${source} must be a YAML map of settings`; `handoff` validated by `isHandoffLevel` with the rungs listed in the error; each boolean key type-checked with the key named. Unknown keys fall through untouched. Empty string parses to `null` → `{}` (pinned by tests). Multi-document YAML: `parse` throws on multiple documents — folded into the warn path, acceptable. Correct.

## Bugs found

1. `L77`: the malformed-file warning does not name the file for YAML syntax errors. `parseFrameworkConfig`'s own validation errors are prefixed with `source`, but a raw syntax error propagates `parseYaml`'s message verbatim, so `onWarn` receives e.g. `ignoring Nested mappings are not allowed in compact mappings at line …` with no mention of `the-framework.yml`. Scenario: a user breaks the YAML syntax (unclosed bracket, bad indent); the startup warning tells them something is ignored but not *which file* to fix. Contradicts the inline comment on L76 ("already prefixes the file name") and `config.test.SPEC.md` ("A malformed file is reported as an ignored file, naming it"); the existing test only covers a validation error (`vanilla: 3`), which happens to be prefixed. Severity: minor. Fix sketch: prefix in the load catch — `onWarn?.(\`ignoring ${name}: ${errorMessage(err)}\`)` (dropping the now-redundant prefix from `parseFrameworkConfig`'s own errors, or accepting the doubled name), or wrap `parseYaml` in `parseFrameworkConfig` and rethrow with `${source}: …`.
