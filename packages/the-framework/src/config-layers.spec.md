Resolves a run's settings (preset, build event, boolean modes) across ordered config layers, where the nearest layer that set a key wins (#841).

## TLDR

- `RunConfigValues` holds what one layer can say: `preset`, `event`, `autopilot`, `technical`, `antiLazyPill`, `transparent` — `undefined` means "this layer said nothing".
- `resolveRunConfig(layers)` picks each key from the nearest layer that set it, falls back to `RUN_CONFIG_DEFAULTS`, and records the winning layer name per key in `sources`.
- `fileConfigLayer` adapts a parsed `the-framework.yml` into a layer; `describeResolvedConfig` renders a one-line narration (`preset=x (the-framework.yml), autopilot=off (flag)`) that omits keys nobody set.

## Decisions

- Layers used to combine with `||`, so a layer could only ever turn a mode *on*; #800 needed "a project overrides only what it sets", which cannot be built on OR. Resolution is now nearest-set-wins: an explicit `false` in a nearer layer beats a farther `true`, and absent stays absent so existing setups resolve identically.
- Layer order, nearest first: run flags > project user prefs > repo yml > global.
- Boolean keys iterate `BOOLEAN_CONFIG_KEYS` from config.ts, so a new mode flows through resolution and the summary automatically.

## Facts

- Defaults: `autopilot`/`technical`/`transparent` false, `antiLazyPill` true.
