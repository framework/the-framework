# Bug analysis: packages/framework/dashboard/components/DevicesSettings.test.tsx

## Business logic (high-level)

Pins the roster management behaviors: empty-state copy, listing label+origin, removal dropping the
profile from storage, and the #1072 guard — removing the run-target device clears the selection
while removing another device leaves it (and the rest of the roster) alone. Matches its test SPEC.

Harness: `checkDevices` RPC hoisted-mocked (health poll never hits a daemon); profiles go through
the REAL `lib/profiles.ts` against jsdom localStorage, and the selection through the real
`remote-target.ts` module — so the tests exercise the actual storage layer rather than stubs,
which is what makes the "drops it from storage" and "clears the run target" assertions
meaningful. `afterEach` clears localStorage, resets the module-level selection (the comment
rightly notes it outlives a test), and resets the mock. All interactions synchronous; the async
status poll is primed to `{}` so badges settle as "Checking…"/absent without assertions on them.

Coverage gaps (not bugs): the status badge states (online/offline/checking), the Add-device
dialog flow (covered by AddDeviceDialog's own tests).

## Functions (low-level)

- "says so when there are no devices" (L24): empty-state text. Correct.
- "lists each saved device with its origin" (L30): label + URL both asserted. Correct.
- "removing a device drops it from storage" (L38): asserts `listProfiles()` empty — end-to-end
  through the real storage. Correct.
- "removing the device a run is targeting clears the run target" (L48): selects then removes,
  asserts `getSelectedRemoteDeviceId() === null`. Correct.
- "removing some other device leaves the run target alone" (L61): the negative half — selection
  preserved, remaining roster asserted by labels. Correct.

## Bugs found

None found.
