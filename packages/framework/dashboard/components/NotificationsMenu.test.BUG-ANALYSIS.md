# Bug analysis: packages/framework/dashboard/components/NotificationsMenu.test.tsx

## Business logic (high-level)

Pins its test SPEC exactly: group structure (both categories real toggles, no static "Always on"
row — a #627 regression guard), write-through of Discord/New activity/Human Queue (including
Human Queue's default-on → first click writes `false`), the permission prompt riding the
switch-on gesture, the blocked hint, and the bell's truth-telling (Discord-on-without-webhook
does not light it and explains why; a configured webhook does light it).

Verification that the tests test what they claim:

- The bell state is read through its *tooltip* via the shared `hoverTooltip` util (#1149), which
  retries the hover inside `waitFor` — robust against listener-attach races; both tooltip reads
  are awaited. The two webhook tests wrap the async tooltip read in `waitFor`, so no un-awaited
  assertions.
- Mock fidelity: the stubbed preference helpers (`?? true` / `?? false` per key) mirror the real
  `NOTIFICATION_DEFAULTS` (`src/preference-defaults.ts`: browser=true, discord=false,
  humanIntervention=true, newActivity=false) — verified against the source, so the suite's
  defaults cannot drift silently *today*; a change to the real defaults would not fail these
  tests (inherent to mocking the lib layer; the defaults have their own home and tests).
- `Notification` is stubbed per test and unstubbed in `afterEach`; `updatePreferences` reset per
  test; `prefs`/`channels.value` re-primed in `beforeEach` — no cross-test bleed. The
  `useNotificationPermission` 3s poll is cleared by `cleanup`'s unmount.
- The write-through test clicks the *label text* of each checkbox item — Base UI's item handles
  the click at the item level, so the assertion exercises the real toggle path; asserting the
  specific payload object pins key and polarity.
- The permission test sets `prefs = { notifyBrowser: false }` + permission 'default' and asserts
  both the preference write (`notifyBrowser: true`) and the `requestPermission` call — the
  gesture coupling the source promises.
- The blocked test asserts the hint text; it does not additionally assert the item's disabled
  state (coverage nit — the SPEC sentence says "disabled and says so"; only the second half is
  pinned). Minor gap, not a wrong assertion.

## Functions (low-level)

- Hoisted `updatePreferences` / `channels` + `vi.mock` of `notify-channels` and `preferences`:
  correct hoisting; `useNotifyChannels: () => channels.value` gives each test direct control of
  the capability fact without racing the real module cache (the comment explains exactly this).
  Correct.
- `bell()` / `open()` / `bellTooltip()`: role-based lookup on the aria-label; tooltip text read.
  Correct.
- Seven tests as described; all falsifiable, each with at least one negative-space assertion
  where the behaviour needs it (`queryByText('Always on')` null, tooltip 'Notifications' for the
  unlit states). Correct.

## Bugs found

None found.
