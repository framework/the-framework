# Bug analysis: packages/framework/src/config-layers.test.ts

## Business logic (high-level)

Tests for the #841 nearest-tier-wins resolution, mirroring `config-layers.test.SPEC.md` claim by claim: the nearest tier that set a key wins; unset tiers neither decide nor shadow; each of the four tiers can win and each can be absent; a nearer explicit `false` beats a farther `true`; with everything silent (or no tiers at all) the defaults hold (`vanilla`/`transparent` off, `handoff` at `pr`) and `sources` is empty; the file layer carries only the keys the file set; the narration lists decided keys with their tier and is empty otherwise.

The `chain(agent, project, repo, global)` helper builds the four tiers in the production order (nearest first), so the tests exercise the same ordering contract the daemon/CLI construct. Assertions are `deepEqual` against exact `{value, from}` / resolved objects, so they cannot pass vacuously.

Coverage vs claims: every SPEC sentence is pinned by at least one assertion, including the subtle nullish-coalescing hazard (an explicit `false` surviving to the resolved config — the first assertion of the nearer-false test) and the equivalence of "no layers" and "layers that set nothing" (`resolveAgentConfig([])` deepEqual to the bare resolution). The loop-over-tiers test rebuilds the chain per tier and asserts both the value and the recorded source, so a resolution that ignored ordering or attribution would fail.

## Functions (low-level)

- `chain(...)` — four `ConfigLayer`s named `run` / `project` / `the-framework.yml` / `global` with the given value objects. Defaults to empty objects; correct nearest-first order. Correct.
- Test `resolveConfigKey takes the nearest layer` — run-false over project-true → `{false, 'run'}`; project-only → `{true, 'project'}`; global-only → `{false, 'global'}`. All three follow from the implementation. Correct.
- Test `ignores layers that left the key unset` — all-unset → `undefined`; a nearer layer that set a *different* key (`vanilla`) does not shadow `transparent` set farther away. Verifies per-key participation, the core #800 property. Correct.
- Test `each layer can win, and each can be absent` — iterates the four names, injecting `transparent: true` into just that tier; asserts value and `sources.transparent`. Then the all-defaults case: values equal `RUN_CONFIG_DEFAULTS`, `handoff === 'pr'` asserted literally (so a changed default is caught here, intentionally), `sources` deep-equal `{}`. Correct.
- Test `a nearer false beats a farther true` — project-false over repo-true → resolved `false` from `project`. This is the one behavior change from the OR era and it is pinned. Correct.
- Test `fileConfigLayer carries only the keys the-framework.yml set` — `{}` → empty values; a partial file copies exactly its two keys; a custom layer name is honored. Correct.
- Test `describeResolvedConfig narrates which layer won` — empty string for nothing configured; the mixed case expects `'transparent=off (run), handoff=local (the-framework.yml)'`, which matches the implementation's ordering (booleans first, handoff last) and the on/off rendering. Correct.

All tests are synchronous and deterministic; no awaits to forget, no shared state between tests.

## Bugs found

None found.
