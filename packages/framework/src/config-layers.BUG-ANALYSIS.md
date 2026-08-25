# Bug analysis: packages/framework/src/config-layers.ts

## Business logic (high-level)

Resolves an agent's settings across ordered config tiers (#841): run flags > project user > repo `the-framework.yml` > global. The rules per `config-layers.SPEC.md`:

- **Nearest tier that set a key wins**; a tier that left a key `undefined` does not participate — so an explicit `false` in a nearer tier beats a farther `true`, which OR-combining could not express (#800).
- **Silence falls to defaults**: `vanilla`/`transparent` off, `handoff` at `pr` (`DEFAULT_HANDOFF`).
- **Attribution**: `sources` records the winning tier per key that some tier actually set; defaulted keys record nothing.
- **Narration**: `describeResolvedConfig` lists only configured keys as `key=value (tier)`, empty when nothing was configured.

All four rules are implemented exactly. The boolean keys are driven off `BOOLEAN_CONFIG_KEYS` from config.ts (the canonical mode list), so a new mode added there flows through resolution and narration automatically; `handoff` is handled explicitly as the one enum key. No lifecycle/concurrency concerns — everything here is pure and synchronous.

Edge cases considered: an empty `layers` array resolves to all defaults with empty `sources` (pinned by the test); a layer whose `values` object carries an explicit `undefined` is treated as unset (the `!== undefined` check), which is the documented meaning of `undefined` in `AgentConfigValues`; `null` is not in the type and would (incorrectly-typed input aside) be treated as "set" — callers provably never produce it (YAML parsing rejects non-boolean, the flag layer builds booleans), so noted as a reliance only.

## Functions (low-level)

- `AgentConfigValues` / `ConfigLayer` / `ResolvedAgentConfig` — shapes match all call sites (fileConfigLayer, cli flag layer, resolveAgentConfig). Correct.
- `RUN_CONFIG_DEFAULTS` — `{ vanilla: false, transparent: false, handoff: DEFAULT_HANDOFF }`; `DEFAULT_HANDOFF` is `'pr'` (verified in handoff-level.ts), matching the SPEC's zero-config rung. Correct.
- `resolveConfigKey(layers, key)` — first layer (nearest-first order is the caller's contract) with a non-`undefined` value wins; returns `{value, from}` or `undefined`. The `as NonNullable<…>` cast is sound given the `!== undefined` guard (no `null` in the type). Correct.
- `resolveAgentConfig(layers)` — `pick` records the source as a side effect only when a tier set the key; booleans loop `BOOLEAN_CONFIG_KEYS` into a `modes` record and spread; `handoff` picked the same way. `??` fallback is safe because the picked values are `boolean`/`HandoffLevel`, never `null`; note `pick(...) ?? default` would mask an explicit `false` if `pick` could return `false`… it can, and `false ?? default` correctly yields `false` (nullish, not falsy, coalescing) — verified. Correct.
- `fileConfigLayer(file, name)` — copies only the keys present in the file config, iterating `CONFIG_KEYS` (handoff + booleans), so retired/unknown keys can never leak in (parseFrameworkConfig already dropped them). `Object.assign` with a computed key sidesteps the union-write typing; behaviorally a plain copy. Default layer name `the-framework.yml` even when the on-disk spelling was `.yaml` — cosmetic at most (the narration would say `.yml`); the one production caller may pass the real name. Correct.
- `describeResolvedConfig(config)` — builds `[key, rendered]` pairs for all mode keys plus handoff, filters by `sources[key]`, joins as `key=value (tier)`. Order is booleans then handoff, while the test expects `transparent=off (run), handoff=local (the-framework.yml)` — matches. Empty string when nothing configured. Correct.
- `onOff(value)` — trivial. Correct.

## Bugs found

None found.
