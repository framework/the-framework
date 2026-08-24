# Bug analysis: packages/framework/dashboard/lib/agent-option-rows.ts

## Business logic (high-level)

The one options table (agent-option-rows.SPEC.md) rendered by the launcher gear, the settings
page and the Resume composer. Pure data (no JSX), which is what lets three surfaces share the
rules. Audit against the SPEC's five guarantees:

- **Effective values, never stored**: `checked` for vanilla/onBeforeMergeableQuality/browser is
  `stored && !transparent` (and browser additionally `agent === 'claude'`); a disabled row
  carries `disabledReason` rendered on the row (the SPEC's tooltip-cannot-open rationale).
  Matches.
- **Transparent as master off-switch**: `overriddenByTransparent` applied to exactly the three
  rows the SPEC names; Transparent itself never disabled. The publish ladder deliberately stays
  un-overridden (the SPEC scopes the override to those three; a transparent run still owns its
  handoff level). Matches.
- **The publish ladder (B5)**: `checked = handoffReaches(handoff, rung)`; each rung *writes the
  rung it means*: push→'push'/'local', pr→'pr'/'push', merge→'merge'/'pr'. Unticking a middle
  rung from a higher level lowers to the rung below (pr.patch(false) from 'merge' → 'push'),
  matching "unticking one lowers the level". Gating: pr disabled unless push reached, merge
  disabled unless pr reached — so the only *tickable* transitions are adjacent rungs upward,
  which keeps every write meaningful. Ticking an already-reached rung cannot happen through a
  checkbox UI (it is already checked), so `push.patch(true)` from 'merge' never fires; noted as
  a UI reliance, harmless. Default: `handoffFromPreferences` (default-on to 'pr', #1102) — the
  test file pins push+pr checked by default, merge off. Matches.
- **Browser Claude-only**: `checked` requires `agent === 'claude'` against the *stored* driver
  (an unknown driver stays non-Claude — deliberate, per the test's comment — even though the
  cosmetic label falls back to Claude Code). Reason strings prioritized: transparent first, then
  the Claude-only wording. Matches.
- **Resume subset**: `resumeOptionRows` filters to push/pr/merge/browser — the ladder and the
  browser, nothing prompt-shaping. Matches.

Rules cross-checked against agent-option-rows.test.ts — every behavior above is pinned by a test,
and the implementation satisfies each.

## Functions (low-level)

- `agentOptionRows(preferences)` — defaults: transparent/vanilla/quality/browser `?? false`,
  driver `?? 'claude'`, handoff via `handoffFromPreferences`. Label fallback for unknown drivers
  via `DRIVERS.includes` guard. Rows built in the documented order. Verdict: correct.
- `flag(key)` — key + `patch: checked => ({ [key]: checked })`. Correct.
- `overriddenByTransparent(transparent)` — `{}` when off so `disabled` stays undefined (tests
  assert `toBeUndefined`, not false — the spread-empty pattern matters and is used). Correct.
- `RESUME_OPTION_KEYS` / `resumeOptionRows(preferences)` — set filter over the same table; same
  gating and effective values by construction. Correct.

## Bugs found

None found.
