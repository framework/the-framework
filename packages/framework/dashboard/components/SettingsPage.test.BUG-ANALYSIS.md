# Bug analysis: packages/framework/dashboard/components/SettingsPage.test.tsx

## Business logic (high-level)

Two tests pinning #1172 on an "empty machine": (1) every `<select>` the page renders has at least
one option (with a sanity floor that selects exist at all — the property test cannot pass
vacuously); (2) the Editor row — the one runtime-assembled list — stays operable with nothing
detected, offering exactly `['Auto-detect']`. Both match the test SPEC. `afterEach` cleans up and
clears localStorage (the checklist's storage).

The empty-machine premise, however, is not wired the way the file claims — see bug 1: the
`../rpc/reads.js` mock stubs several functions that module does not export, while the reads the
page actually makes go to their real, unmocked rpc modules. The tests still pass because every
consuming hook swallows the failing transport call into the same empty answer the stubs were
meant to give — verified: `useDetectedEditors` → `useLoaded` (catch keeps `[]`),
`lib/preferences.ensureLoaded` (`.catch(() => { cache ??= {} })`), `lib/notify-channels.load`
(`.catch(() => {})`, null cache), and the checklist's reads via the same read hooks. So the
assertions are genuinely exercised and can fail on a real regression (an Editor row with a bogus
option, an empty select) — the defect is fixture honesty and fragility, not vacuity.

Also verified: the two mocked names that DO exist in `rpc/reads.js` (`onBridgeToken`,
`onDashboard`) are real exports, so those two stubs are live; `checkDevices` correctly targets
`rpc/devices.js`.

## Functions (low-level)

### Mock setup

`vi.mock('../rpc/devices.js')` — correct seam. `vi.mock('../rpc/reads.js', importOriginal…)` —
spreads the real module then overrides six names; four of them (`onNotifyChannels`,
`onPreferences`, `onDetectedEditors`, `onOnboardingSuggestion`) are not exports of
`rpc/reads.ts` (checked its full export list) and none of the page's code imports them from
there — `onEditors`, `onNotifyChannels`, `onPreferences` live in `rpc/preferences.ts` and the
checklist's `onOnboarding` in `rpc/projects.ts`. Dead stubs. Verdict: bug found (fixture).

### Test "no dropdown renders with nothing in it"

Property-style: all selects non-empty, and at least one select exists. Sound.

### Test "an editor list the daemon could not fill still leaves a usable Editor row"

Exact option-list assertion via `getByLabelText('Editor')` (the select's aria-label). Sound.

## Bugs found

1. `L9-L17`: the `../rpc/reads.js` mock does not intercept the reads it is written for.
   `onNotifyChannels`, `onPreferences`, `onDetectedEditors` and `onOnboardingSuggestion` are not
   exports of `rpc/reads.ts` — the page reaches those reads through `rpc/preferences.js`
   (`onEditors`, `onNotifyChannels`, `onPreferences`) and `rpc/projects.js` (`onOnboarding`),
   all left unmocked. Every such call therefore hits the real rpc transport in jsdom and fails;
   the "no editors / no preferences / no channels" fixture the comment promises actually comes
   from each hook's error-swallowing fallback, not from the stubs. The tests currently pass for
   the right observable reasons, but the suite (a) performs real transport attempts per render,
   and (b) breaks confusingly the moment any of those hooks stops treating a transport failure
   as "empty" — the stubs would still sit there asserting a fixture that never applied.
   Severity: minor (test-infrastructure defect, no wrong assertion today). Confidence: high on
   the mismatch (export lists verified). Fix: mock the real modules — e.g.
   `vi.mock('../rpc/preferences.js', …)` stubbing `onEditors`/`onNotifyChannels`/`onPreferences`
   (spreading `importOriginal` for the rest) and `vi.mock('../rpc/projects.js', …)` for
   `onOnboarding` — and delete the four dead keys from the reads.js factory.
