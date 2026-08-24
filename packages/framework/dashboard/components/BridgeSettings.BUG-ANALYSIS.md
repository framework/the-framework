# Bug analysis: packages/framework/dashboard/components/BridgeSettings.tsx

## Business logic (high-level)

Settings sub-panel for the Claude-web browser bridge. Responsibilities per `BridgeSettings.SPEC.md`:
render nothing while the bridge is disabled; once enabled, explain the extension setup, hand over the
bridge token (masked, revealable, copyable), say "restart" when no token exists, and poll bridge
status to surface the two turn-away conditions (version block #1519, rejected token #1225) with the
version block taking precedence.

Lifecycle/invariants checked:

- **Disabled → cleared state.** Both effects reset their state (`blocked`/`refused`, `token`/`shown`)
  when `enabled` flips false, and the render returns `null`. The SPEC's "revealing resets whenever
  the bridge is switched off" is honored (`setShown(false)` in the token effect's disabled branch).
- **Polling.** The status effect polls every 5s while enabled; interval is cleared and a `live` flag
  guards against setState-after-cleanup on both the initial read and in-flight interval reads. No
  leak: cleanup runs on disable/unmount. Errors are swallowed (`.catch(() => {})`) — acceptable here
  since a failed poll just keeps the last rendering; the next tick retries.
- **Precedence.** `blocked` renders its banner; `!blocked && refused` renders the token-rejection
  banner — version block outranks refused contact, matching the SPEC and the test
  ("a version block outranks a refused contact").
- **Token fetch.** One-shot per enable. `live` guard prevents a stale set after disable. A re-enable
  re-runs the effect (dependency `[enabled]`), so the token reappears.

Notable reliances (not bugs): the component trusts `onBridgeStatus`'s shape
(`version?.blocked`, `lastContact?.status`); the daemon-side RPC is typed, so this holds.

## Functions (low-level)

### `BridgeSettings({ enabled, onChange })`

- **Props**: `enabled: boolean`, `onChange: (next: boolean) => void`. `onChange` is **never used**
  anywhere in the component — the enable/disable toggle lives in `SettingsPage.tsx` (its
  `ToggleRow`, line ~200) which already passes the same handler there. Dead prop; no runtime
  consequence (the parent's closure is cheap), so this is cleanliness, not behavior. Not reported
  as a bug.
- **Status-poll effect (L32–53)**: correct dependency (`enabled`), correct cleanup, `live` flag
  correct. Edge: `status.lastContact?.status === 401` — only exactly 401 counts as refused, which
  matches the daemon's auth-rejection status. A 403 or other codes would not trigger the notice;
  nothing in the SPEC suggests other codes exist for this condition. Verdict: correct.
- **Token effect (L55–70)**: one fetch per enable; errors swallowed, leaving `token === null`, which
  renders the "restart" message — a failed RPC thus masquerades as "no token yet". Given the RPC is
  same-origin to the daemon serving the page, a failure mode where the page loads but this one RPC
  fails is marginal. Verdict: correct-with-noted-reliance.
- **Render (L72–106)**:
  - `token === null` → "Restart the dashboard to generate the token." This state is also the
    *loading* state: on every mount with a perfectly valid token, the panel flashes the restart
    instruction until `onBridgeToken` resolves. The SPEC ties this message to "when no bridge token
    exists"; showing it transiently when one does exist is a (brief, local-RPC-fast) false
    instruction. Minor; see Bugs.
  - Mask is `'•'.repeat(24)` — constant length regardless of token length (deliberate: doesn't leak
    length). Reveal toggles `shown`; CopyButton copies without revealing. Matches SPEC.
  - Blocked banner text includes both versions and `chrome://extensions` — matches tests.

## Bugs found

1. `L91`: While `onBridgeToken()` is still in flight, `token` is `null` and the panel renders
   "Restart the dashboard to generate the token" even when a token exists — the initial state is
   indistinguishable from "daemon has no token". Scenario: open Settings with the bridge enabled and
   a token already generated; the restart instruction flashes for the round-trip duration (and
   stays up indefinitely if the RPC errors, since `.catch(() => {})` keeps `token` null). Contradicts
   the SPEC, which reserves this message for "when no bridge token exists". Severity: minor.
   Fix sketch: use a third state (`'loading' | string | null`), render nothing (or a skeleton) while
   loading, and only show the restart message once the RPC resolved to `null`.

No other bugs found.
