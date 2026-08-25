# Bug analysis: packages/framework/src/dashboard-rpc/relay-dispatch.test.ts

## Business logic (high-level)

Pins the device-side whitelist dispatcher: the whitelist covers the run-scoped read/steer/handoff
surface, excludes the destructive/start names, refuses unknown names, and runs a permitted call
against the home id with the caller's project id discarded.

Do the tests verify what they claim?

- Whitelist inclusion test: asserts 15 names are present. It checks a *subset* — `sendMerge` is on
  the real whitelist but not asserted here, so the merge half of `relay-dispatch.test.SPEC.md`'s
  claim ("steering actions and handoff actions") is only partially pinned. A regression that
  dropped `sendMerge` from the whitelist would pass this test. Gap, not a wrong assertion; noted
  but below the reporting bar (the SPEC file for the test describes coverage, and dropping
  `sendMerge` would break the remote-run integration test's surface).
- Exclusion test: `sendStart`, `sendDeleteAgent`, `sendRemoveWorktree` are real exports whose
  absence is load-bearing and correctly asserted. `sendPreview` does not exist as an export
  anywhere, so its assertion is vacuously true — harmless (documents intent).
- Unknown-name test: `sendStart` (a real RPC that must not be relayable) and `nope` both reject
  with `/unknown relay rpc/`. This is the strongest guard in the file: it proves a whitelisted-off
  name is *refused*, not merely unlisted. Correct.
- Home-id test: `dispatchRelayRpc('the-framework:no-such-home', 'onGitStatus', ['remote-project-id', 'run-1'])`
  must resolve `null`. This genuinely proves the call reached `onGitStatus` (a throw or a non-null
  would fail) and that the first arg was replaced (the id passed is unregistered, so only the
  replaced id's resolution path returns null; had `'remote-project-id'` been used the result would
  be identical, so strictly it proves "arg[0] position is the project id" rather than "the
  caller's id was discarded" — but combined with the source's single code path this is adequate).
  `provideTestContext()` wires `remote.target: () => undefined`, so `relayOr` inside `onGitStatus`
  takes the local branch — the no-forward-loop property is exercised implicitly. Correct.

## Functions (low-level)

Three `test()` blocks, no helpers. All can fail; none assert tautologies except the noted
`sendPreview` line inside an otherwise meaningful loop.

## Bugs found

None found. (Two coverage gaps noted above — `sendMerge` unasserted, `sendPreview` vacuous — are
test-thoroughness wishes, not bugs.)
