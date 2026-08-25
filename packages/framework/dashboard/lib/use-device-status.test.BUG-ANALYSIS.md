# Bug analysis: packages/framework/dashboard/lib/use-device-status.test.tsx

## Business logic (high-level)

Tests for `useDeviceStatus` (#1072): the browser holds each saved device's token and hands the
daemon `{id, url, token}` triples; the daemon does the cookie'd ping and answers a reachable map.
The tests pin exactly what the test SPEC claims: (1) a `true` answer surfaces as `online`, (2) a
`false` answer surfaces as `offline`, (3) with no saved devices no poll is made and the status
reads `unknown`, and (1) additionally pins the wire shape passed to `checkDevices`.

The mock strategy is sound: `checkDevices` is `vi.hoisted` + `vi.mock('../rpc/devices.js')`, and
`use-device-status.js` is imported top-level-await *after* the mock is registered, so the hook
resolves the mocked module. `afterEach` runs `cleanup()` (unmounting the Probe, which clears
`usePolled`'s interval via its effect cleanup) and `mockReset()` — no state leaks between tests.

Timing: the poll interval is 10s, real timers are used, and each test finishes in well under a
second, so only the initial read is ever observed — the tests do not (and do not claim to) cover
re-polling. The 30ms sleep in test 3 is long enough to catch an erroneous immediate call
(`usePolled` calls `load` synchronously in the mount effect when non-null), so the negative
assertion has teeth.

## Functions (low-level)

- `Probe({ list })` — renders `status[STUDIO] ?? 'unknown'`. Uses the map-lookup shape the real
  status dots use (absence = unknown). Correct.
- Test "a reachable device surfaces online" — `mockResolvedValue({[STUDIO]: true})`, waits for
  the text, then asserts `checkDevices` got `[{id, url, token}]`. `toHaveBeenCalledWith` compares
  structurally, so property order is irrelevant; the assertion also proves `label` is *not* sent
  (the object has exactly id/url/token — toHaveBeenCalledWith is exact on extra keys). Correct.
- Test "an unreachable device surfaces offline" — mirror case. Correct.
- Test "with no saved devices it never polls" — empty list → `targets.length === 0` → `load`
  null → `usePolled` never calls. The 30ms wait plus `not.toHaveBeenCalled` and the `unknown`
  render pin both halves. Correct.

Edge cases deliberately not covered (and not claimed by the test SPEC): a profile with an empty
token being filtered out, the token-in-key re-poll behavior, and interval re-polling. Those live
in the hook's SPEC; the test SPEC's scope statement matches what is here.

## Bugs found

None found.
