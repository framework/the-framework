# Bug analysis: packages/framework/dashboard/lib/agent-option-rows.test.ts

## Business logic (high-level)

Pins the rules of the shared options table so the launcher and the settings page cannot quietly
disagree: ladder order and defaults, what each rung's patch writes, the gating (pr needs push,
merge needs pr), Transparent's override, Browser's Claude-only rule (including the
unknown-driver case), and the Transparent description naming the selected agent.

Do the tests verify what they claim?

- Ladder test: asserts order via filtered keys, default checked states (push+pr on, merge off via
  the next describe), and that `handoff: 'push'` unchecks pr. Real assertions on the produced
  rows. Sound.
- Patch test: asserts the exact `Partial<Preferences>` each rung writes from a 'merge' level —
  `toEqual` on the object, so an accidental extra key would fail. Also pins the plain-flag write
  (`browser.patch(true)`). Sound.
- Gating tests: assert `disabled === true` *and* `disabledReason` wording (regex on "Push
  branch"), plus the deliberate `toBeUndefined()` for a live row — which pins the spread-empty
  implementation detail that the disabled key is absent, not false. Sound.
- Transparent test: loops the three overridden keys asserting effective-off + disabled with
  per-key failure messages; asserts Transparent itself on and enabled. Sound.
- Browser tests: codex → off/disabled/reason; claude → on/enabled; unknown driver 'nope' →
  off/disabled (the label-vs-rule distinction the comment explains). Sound.
- Description test: regexes Codex/Claude in the Transparent row description. Sound.

Coverage gaps (noted, not bugs): no test for `resumeOptionRows` (the #1172 subset — its filter
set and that gating/effective values carry over) and none for the `disabledReason` precedence
when transparent && codex both apply to Browser. The behaviors exist and are simple; still, the
subset function is exported product logic with zero pinning.

Helper `find` uses a non-null assertion — a missing key would throw a TypeError rather than an
assertion failure; acceptable in tests (still fails the test loudly).

## Functions (low-level)

- `rows(preferences)` / `find(list, key)` — thin helpers; see note on `!`. Correct.

## Bugs found

None found.
