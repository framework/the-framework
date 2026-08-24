# Bug analysis: packages/framework/dashboard/components/BridgeSettings.test.tsx

## Business logic (high-level)

Pins down the turn-away reporting of `BridgeSettings` (version gate #1519, refused token #1225) as
listed in `BridgeSettings.test.SPEC.md`:

- blocked extension → notice naming both versions and `chrome://extensions`;
- accepted version → no blocked notice;
- 401 last contact → rejection notice telling the user to re-save the token;
- 200 contact → no rejection notice;
- blocked + 401 simultaneously → only the version banner (precedence).

Coverage matches the test SPEC exactly. The token masking/reveal/copy behavior and the
"restart to generate" state are *not* covered here (SPEC'd in the component's own SPEC, untested) —
a coverage gap, not a test bug.

Mechanics: `onBridgeToken`/`onBridgeStatus` are hoisted `vi.fn`s backing a `vi.mock` of
`../rpc/reads.js`; `afterEach` runs `cleanup()` + `vi.clearAllMocks()`. `clearAllMocks` clears call
records but keeps implementations — each test that cares sets its own `mockResolvedValue`, so no
cross-test leakage of *behavior*; the default implementations from `vi.hoisted` remain as fallback
(used implicitly for `onBridgeToken` in every test). Sound.

## Functions (low-level)

### Test: "a refused extension is named, with both versions and the way out" (L23–37)

`findByText(/blocked/)` awaits the async status render; asserts got/expected versions and the
`chrome://extensions` pointer appear in the same paragraph. Properly awaited; can fail. Correct.

### Test: "an accepted version shows no blocked notice" (L39–50)

Awaits the always-present intro paragraph (`/paste this token/`, rendered synchronously), then
asserts `queryByText(/blocked/)` is null. Weakness: the awaited text does not depend on the status
promise, so in principle the negative assertion could run before the mocked `onBridgeStatus`
promise's `.then` has applied state. In practice RTL's async `findBy` wrapper (async `act`) drains
the microtask queue before returning, and the mock resolves in one microtask, so the state *is*
applied by assertion time; the test does catch a regression that renders the banner for
`blocked: false`. Suspicious-but-unproven as a flake source; not a cannot-fail test. Verdict:
acceptable, noted.

### Test: "a rejected token is named, with the way out" (L54–66)

Awaits the banner keyed on the async state (`/token this dashboard rejects/`) — properly awaited.
Correct.

### Test: "an accepted contact shows no refused notice" (L68–78)

Same structural weakness as the accepted-version test (anchor text is synchronous), same practical
adequacy. Also note `queryByText(/rejects/)` would match only the refused banner — no other copy in
the component contains "rejects". Correct.

### Test: "a version block outranks a refused contact..." (L80–92)

Awaits `/blocked/` — which *is* produced by the async state, so by then the same render pass has
also decided the refused banner's absence (`!blocked && refused` is false in that very render).
The negative assertion is therefore properly ordered. Correct; this is the strongest of the three
negative tests.

## Bugs found

None found. (The two negative tests anchored on synchronous text are theoretically
timing-lenient but are drained by RTL's async act in practice; recorded above as a note, not a
bug.)
