# Bug analysis: packages/framework/src/dashboard-rpc/relay-dispatch.ts

## Business logic (high-level)

The device side of the remote-agent relay (#1067 slice 2): which RPCs another daemon may invoke
about an agent running here. Per `relay-dispatch.SPEC.md`: a fixed whitelist of agent-scoped reads
and steering/handoff actions (start/preview/delete deliberately absent), an unknown name refused,
and the caller's `args[0]` (its own project id, meaningless here) replaced with this device's home
project id so a relayed call can never address another registered project.

Security/correctness review:

- **Prototype pollution**: `RELAY_FNS` is built on `Object.create(null)`, so a request-controlled
  `fn` of `constructor` / `toString` / `valueOf` finds nothing and is refused — matching the SPEC's
  "including the names every object carries by inheritance". Verified.
- **Whitelist membership**: every entry is a real export of `reads.ts`/`control.ts`, and every one
  takes `projectId` as its first parameter (verified against both modules), so the arg[0]
  replacement is type-sound for the whole list. `sendStart`, `sendDeleteAgent`,
  `sendRemoveWorktree`, `sendAddProject`, preview and the bridge sends are all absent. Correct.
- **Argument trust**: the remaining args (paths, agent ids, texts, choice picks) pass through
  unchanged and then face the same guards a local browser call faces (`safeRepoPath`,
  `isSafeAgentId` via `resolveAgentCheckout`, label validation) — the SPEC's stated design. A
  relaying daemon can steer (send messages/choices) — that is the feature, not an escalation.
- **Loop prevention**: the whitelisted fns run with no wired `remote` on the device, and
  `contextRemote()` defaults to "nothing relayed from here", so they resolve locally. Correct.
- **Unknown name**: throws `unknown relay rpc: <fn>`; the `/_relay/rpc` mount turns that into a
  non-2xx, which the calling daemon's `relayOr` maps to the empty shape. Correct.
- Edge: `args` shorter than the fn's arity (e.g. `[]`) → `impl(homeId)` with missing params; each
  fn already tolerates or fails softly (e.g. `onAgent(cwd, undefined)` → `loadAgentEvents` refuses
  the unsafe id → `[]`; a `sendChoice` with undefined id appends a malformed entry the agent's
  control reader ignores). No crash path found that escapes the mount's error handling.

## Functions (low-level)

- `RELAY_FNS` — null-prototype record of the 16 handlers. The double cast
  (`as unknown as Record<string, RelayFn>`) erases per-fn signatures, which is what allows the
  spread-call below; safe because all listed fns are `(projectId, ...rest) => Promise`. Correct.
- `RELAY_RPC_NAMES` — `Object.keys(RELAY_FNS)`; own enumerable keys only, matches the whitelist.
  Correct.
- `dispatchRelayRpc(homeId, fn, args)` — lookup, throw on miss, `impl(homeId, ...args.slice(1))`.
  `args.slice(1)` on an empty array is `[]` (no throw). Correct.

## Bugs found

None found.
