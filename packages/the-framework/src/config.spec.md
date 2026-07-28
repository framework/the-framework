Loads and validates the per-repo `the-framework.yml` run defaults (#204), so a project's preset/modes travel with the code instead of being retyped as flags.

## TLDR

- `FrameworkFileConfig`: strings `preset`, `event`; booleans `autopilot`, `technical`, `antiLazyPill`, `transparent`.
- `loadFrameworkConfig(dir)` tries `the-framework.yml` then `.yaml`; missing yields `{}`, malformed is reported via `onWarn` and treated as `{}` — never a failed run. CLI flags override whatever it returns.
- `parseFrameworkConfig` throws on a non-map document or mistyped field so the loader can surface it as a warning.

## Decisions

- `STRING_CONFIG_KEYS`/`BOOLEAN_CONFIG_KEYS`/`CONFIG_KEYS` are the canonical key lists: parsing, the config-layer copy, resolution, and the resolved-config summary all iterate them, so a new mode is added once and flows through.

## Facts

- `transparent` (#625) is the coarse per-project master off-switch: every run becomes a raw `claude -p` — no framework system prompt, no emit protocols, no consumption guard, no dashboard, no TODO loop.
- `antiLazyPill` (#326 via #301) defaults `true`; set `false` to remove the built-in system prompt.
