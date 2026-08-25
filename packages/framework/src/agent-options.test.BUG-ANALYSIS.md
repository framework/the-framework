# Bug analysis: packages/framework/src/agent-options.test.ts

## Business logic (high-level)

Eight synchronous `node:test` cases over the three exports. No I/O, no mocks — the module under test
is pure, so the tests are plain input/output assertions and every one of them can genuinely fail.

Behaviours pinned, checked against `agent-options.SPEC.md`:

- **The handoff ladder** (`L5`): the `pr` default at both entry points, and every one of the four
  rungs travelling explicitly through `agentOptionsFromPreferences`. The loop over
  `['local','push','pr','merge']` is what pins "an agent can never re-arm what the launcher
  disarmed" — dropping the unconditional `handoff` line in the source would fail on the very first
  iteration. Good coverage of the SPEC's central publish rule.
- **The yml-owned toggles as explicit booleans** (`L17`): both polarities. The `false` case is the
  one that matters (a conditional spread would make the key `undefined`), and it is asserted via
  `deepEqual` against `{vanilla:false, transparent:false}`; under `assert.strict` a missing key does
  not deep-equal an explicit `false`, so this cannot pass on a regression.
- **File config → preferences** (`L24`): empty in / empty out, both polarities of `vanilla`,
  `transparent: true`, and two handoff rungs. `deepEqual(preferencesFromFileConfig({}), {})` is a
  real assertion under `assert.strict` — `{transparent: undefined}` would *not* deep-strict-equal
  `{}` — so an accidental unconditional spread is caught. The one gap: `transparent: false` is
  never asserted through `preferencesFromFileConfig` directly (only `vanilla: false` is), though the
  next test covers the same property for `transparent` via the merge.
- **Layering, key by key** (`L37`): builds the merge inline (`{...global, ...repo}`) rather than
  calling a production merge function, so strictly it tests object-spread semantics *plus* the
  shape `preferencesFromFileConfig` returns. That is still the meaningful half — the assertion at
  `L44` (an explicit `false` in the repo file wins over the user's `true`) only holds because the
  mapper emits present-but-false keys, which is exactly the source behaviour worth pinning. The
  comment at `L45` ("the repo's antiLazyPill:false maps to exactly this key") no longer matches the
  input on `L41` (`vanilla: true`) — stale prose, not a broken assertion.
- **Driver / model / target / browser omissions** (`L48`, `L54`, `L59`, `L65`): each asserts both
  the omitted and the travelling case, so neither direction can rot silently. `.driver`,
  `.model`, `.target`, `.browser` are read off the returned object and compared to `undefined`,
  which is how a conditionally-spread key reads when absent — correct technique.
- **The Auto PM path** (`L70`): merge the user tier with the file tier, then map. Asserts the
  repo's `transparent: true` wins and the user's `model` survives untouched. This is the closest
  thing in the file to an end-to-end check of the two-tier story.

Not covered (missing coverage, not bugs): `onBeforeMergeableQuality` in either direction — the only
mapped preference with no test at all; `context` (empty vs non-empty); `browser` with `driver`
unset (the "unset means Claude, so the preview travels" branch); and a `handoff` set on the user
tier being overridden by the file tier.

No test is `async`, so there is no unawaited-assertion hazard anywhere in the file, and no test
asserts on a value it also computed with the code under test in a way that would make it
tautological.

## Functions (low-level)

### `test('the handoff defaults to the PR rung, and every rung travels explicitly')` (`L5`)

Four assertions plus a four-iteration loop with two assertions each. Uses `as const` so the rung
list is type-checked against `HandoffLevel`. Verdict: correct.

### `test('the yml-owned toggles travel as explicit booleans')` (`L17`)

Projects the two keys of interest into a fresh object before comparing, so unrelated keys on
`StartAgentOptions` cannot break it. Verdict: correct.

### `test('preferencesFromFileConfig maps the repo yml onto the preference keys')` (`L24`)

Six `deepEqual`s on whole objects, which also pins that *nothing extra* is contributed. Verdict:
correct.

### `test('a repo yml sits over the user tier, key by key')` (`L37`)

Tests the spread the callers perform rather than a production function; see above. Verdict:
correct (weak but not wrong).

### `test('the agent is sent only when it is not the default')` (`L48`)

Verdict: correct.

### `test('the model passes through, and an empty one does not')` (`L54`)

Pins the truthiness test on `model`, which is the reason `model` and `driver` are guarded
differently in the source. Verdict: correct.

### `test('the run target is sent only when it is not the default local')` (`L59`)

Covers unset, explicit `local`, and `actions`. Verdict: correct.

### `test('browser is dropped for an agent that cannot use it')` (`L65`)

Covers `browser` with the default driver and with `codex`. Verdict: correct.

### `test("the repo's file beats your own settings")` (`L70`)

Verdict: correct.

## Bugs found

None found.
