# Bug analysis: packages/framework/src/agent-options.ts

## Business logic (high-level)

The single mapping from settled preferences to the options an agent starts with (#858), shared by
the dashboard launcher and by Auto PM in the daemon. Pure code, no Node imports, re-exported from
the browser-safe `./client` entry — the reason it is a separate module at all is that the rules are
not a field copy (Claude-only browser, ladder-valued handoff, always-explicit yml-owned toggles),
and Auto PM previously passed nothing, so unattended agents ignored every per-project setting.

Three exports, three responsibilities:

1. `preferencesFromFileConfig` — reads a repo's committed `the-framework.yml` *as preferences*, so
   the file can be layered under the user's own tier with a plain spread. The contract is
   "only the keys the file actually set", which is what makes `{...user, ...repo}` leave unset keys
   alone. Verified against `config.ts`: `FrameworkFileConfig` declares exactly `vanilla`,
   `transparent`, `handoff` — all three are mapped, none is missed, and none is invented. (The
   JSDoc's mention of `preset` and `event` staying "on the raw file config" is stale — those keys no
   longer exist on the interface — but it describes an absence, so nothing behaves wrongly.)
2. `handoffFromPreferences` — the one place the `pr` default lives.
3. `agentOptionsFromPreferences` — the mapping proper, split into "always stated" and "only when it
   adds something".

The always/never-stated split is the load-bearing invariant, and it lines up with the SPEC: a
setting the repo's `the-framework.yml` can also set must go on the wire *even when off/default*,
because the CLI resolves the launcher's value as the nearest layer and silence would let the repo
file turn back on what the launcher just showed as off (or publish further than it showed).
`vanilla`, `transparent` and `handoff` are exactly the file-settable keys, and exactly the three
that are stated unconditionally. Everything else is omitted at its default so a default agent's
options stay byte-identical to before the setting existed. That correspondence is airtight against
today's `FrameworkFileConfig`; the only way it could rot is a new key added to the file config
without a matching unconditional line here — worth knowing, not a present bug.

Ordering/merge concerns: the function explicitly takes the *already merged* view, so the
global-vs-project precedence question is not this file's (`resolvePreferences` owns it). There is no
state, no async, no I/O — no races, no lifecycle. The only inputs that could misbehave are
malformed preference values, and their producers are constrained: `handoff` is validated by
`parseFrameworkConfig`'s enum check on the file path and by the `HandoffLevel` type on the
preferences path; `driver` comes from a fixed `DRIVERS` select in `SettingsPage.tsx:93-95`, so the
`driver !== 'claude'` test cannot be fed an empty string the way `model` can (which is why `model`
gets a truthiness test and `driver` an inequality test — the asymmetry is justified, not an
oversight).

## Functions (low-level)

### `preferencesFromFileConfig(file: FrameworkFileConfig): Preferences` (`L29`)

Conditional spread per key, keyed on `!== undefined` rather than truthiness — the important
detail, since `vanilla: false` / `transparent: false` in the committed file must survive as an
explicit `false` that beats the user's `true` on the merge. Empty input → `{}` (contributes
nothing). Unknown extra keys on the object are dropped, which is right: the daemon must not
forward file keys that have no preference meaning. Verdict: correct.

### `handoffFromPreferences(preferences: Preferences): HandoffLevel` (`L49`)

`preferences.handoff ?? DEFAULT_HANDOFF`. `??` rather than `||` matters only if `''` were a
possible value; `HandoffLevel` is a closed union, so no. Verdict: correct.

### `agentOptionsFromPreferences(preferences, context = []): StartAgentOptions` (`L59`)

Locals normalise every optional preference to a concrete value, then the object literal decides
what travels.

- `vanilla`, `transparent`: always emitted, `false` included. Matches SPEC "Settled answers are
  stated explicitly". Correct.
- `onBeforeMergeable`: emitted only when `onBeforeMergeableQuality` is on. This key is *not*
  settable in `the-framework.yml`, so omission cannot be overridden by the repo file — the
  always-state rule does not apply to it, and the SPEC says so ("sent only when it is on").
  Correct.
- `handoff`: always emitted, every rung. Correct (its default is `pr`, i.e. *not* the do-nothing
  value, so silence would publish more than the launcher showed).
- `browser`: emitted only when on *and* the driver is Claude Code. Note the driver used for this
  test is the normalised local (`preferences.driver ?? 'claude'`), so an unset driver counts as
  Claude and the preview travels — correct, since unset means Claude. Correct.
- `model`: truthiness test, so `''` (a cleared model) is omitted rather than sent as an empty
  `--model`. Correct.
- `driver`: emitted only when not `claude`. Correct.
- `target`: `target && target !== 'local'`, over a local already defaulted to `'local'`; the extra
  truthiness guard is redundant but harmless. Correct.
- `context`: emitted only when non-empty; the default `[]` means callers that have no extra
  context need not pass anything. Note the array is passed through by reference rather than copied
  — every caller builds a fresh array, and nothing here mutates it. Correct.

Verdict: correct.

Stale prose worth flagging for a reader, not a defect: the module JSDoc still describes "autopilot
defaults on" and "the four eco preferences collapse into one object" — neither autopilot nor eco
appears anywhere in the current mapping.

## Bugs found

None found.
