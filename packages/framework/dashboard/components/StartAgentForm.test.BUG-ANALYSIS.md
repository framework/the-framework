# Bug analysis: packages/framework/dashboard/components/StartAgentForm.test.tsx

## Business logic (high-level)

Tests for the launcher form, mocked at the `rpc/` stubs (no daemon behind jsdom) plus the lib hooks
(`preferences`, `profiles`, `remote-target`, `use-start-agent`) and the child components (Composer
reduced to two submit buttons that hand back the contract's two kinds). Four suites pin:

1. **Submit kinds (#1279)** — a preset submit passes `kind='prompt'` and `unattended: true`; a typed
   submit passes `kind='build'` and no `unattended`. Asserted on `start.mock.calls[0]` — genuinely
   verifies the option the daemon receives.
2. **Driver preflight (#1326/#1419)** — problems render (with the fix command), warnings render,
   a ready driver shows no alert, the probe re-runs per driver, the gh half (second arg) tracks the
   armed handoff (`push` → false, `pr` → true), and `target: 'actions'` never probes.
3. **Haiku warning (#1439)** — shows as `role="alert"` for `model: 'haiku'`, absent otherwise, and
   the submit path stays present (non-blocking).
4. **Auto-merge notice (#1417)** — `known && !allowed` renders the merge-on-green note (with the
   server-side setup), `allowed` and `!known` do not, and an unarmed merge never calls the RPC.

Test hygiene: `afterEach` resets `start`, `onDriverReady`, `onRepoAutoMerge`, and `prefs.current`;
`beforeEach` re-arms a ready driver. `onProjects` / `onSystemPromptUser` are **not** reset — every
test re-arms their resolved value, so behavior is right, but their call counts accumulate across
tests. Several tests use `waitFor(() => expect(onProjects).toHaveBeenCalled())` purely as a settling
barrier; with accumulated counts that waitFor passes on its first synchronous check. This is
harmless here because the assertions that follow are about synchronous facts: `useLoaded` invokes
its load synchronously inside the mount effect (flushed by RTL's `act` before `render` returns), so
`onDriverReady` / `onRepoAutoMerge` would already have been called by the time the negative
assertions (`not.toHaveBeenCalled()`) run. The tests therefore still fail when the behavior breaks —
weakened settling, not a cannot-fail test.

The `toHaveBeenCalledTimes(2)` in the allows/unknown auto-merge test is safe because
`onRepoAutoMerge` *is* reset per test (two renders in one test → counts 1 and 2).

## Functions (low-level)

- **Composer mock** — forwards `onSubmit(text, kind, { newAgent: false })`; the extra third arg is
  ignored by the form's `submit(text, submitKind)`. Matches the real Composer contract
  (`onSubmit(text, kind, opts)`), so the mock cannot drift the signature under test. `ref` is
  discarded, so `composerRef.current?.clear()` is a no-op — fine, no test asserts clearing.
- **`prefs` hoisted holder** — mutable preferences per test, reset in `afterEach`. Correct pattern
  (the component reads `usePreferences()` fresh each render).
- **Preset submit test** — asserts `calls[0][2] === 'prompt'` and `calls[0][3]` matches
  `{ unattended: true }`. Correct.
- **Typed submit test** — asserts no `unattended` property. Correct (the form passes `options`
  untouched).
- **Logged-out / root-warning tests** — assert the message text renders; the role distinction
  (danger vs warning styling) is not asserted, only presence. Adequate.
- **Re-probe test** — unmounts and re-renders with `driver: 'codex'`; asserts
  `toHaveBeenCalledWith('codex', true)`. Correct; `publishArmed` stays true because DEFAULT_HANDOFF
  is `pr`.
- **gh-half test** — `handoff: 'push'` → `('claude', false)`; `handoff: 'pr'` → `('claude', true)`.
  Matches `handoffReaches(level, 'pr')`.
- **Actions test** — `onDriverReady` must not be called; valid per the synchronous-load argument
  above.
- **Haiku tests** — `findByText` + role check; the negative test settles on `onProjects` (weak
  barrier, but the warning render is synchronous from prefs, so absence is meaningful).
- **Auto-merge tests** — positive asserts three text fragments and the submit button; negative
  covers both `allowed` and `known: false`; the unarmed test asserts the RPC is never asked.

## Bugs found

None found. (The unreset `onProjects` call counts make the `waitFor` settling barriers pass
prematurely, but every assertion that follows concerns state already established synchronously at
render time, so no test is rendered unable to fail — recorded as hygiene, not a bug.)
