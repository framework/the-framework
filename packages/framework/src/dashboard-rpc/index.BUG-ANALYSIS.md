# Bug analysis: packages/framework/src/dashboard-rpc/index.ts

## Business logic (high-level)

Assembles the dashboard's call table. Two invariants per `index.SPEC.md`:

1. **Exporting is registering**: `RPC_HANDLERS` is built from `Object.entries` over the six modules (reads, control, projects, preferences, quota, devices), keeping only functions — so an exported-but-unregistered RPC (the #866 failure) cannot exist. Type-only exports (`QueueTicketResult`, `NotifyChannels`, …) have no runtime binding and are naturally absent; non-function values would be filtered. The events module is deliberately *not* in the list: `streamAgentEvents` is exposed separately as `RPC_EVENT_STREAM` (a subscription, `GET /_rpc/events`), matching the SPEC.
2. **Null prototype**: the table is `Object.assign(Object.create(null), …)`, so `POST /_rpc/constructor`, `__proto__`, `toString` etc. miss and 404 instead of resolving to `Object.prototype` members. Verified: lookup in `rpc-serve.ts` indexes this table directly with the request's path segment, so the null prototype is load-bearing.

The flip side of invariant 1 is where the defect is: *every* exported function of those modules becomes an unauthenticated-by-name HTTP endpoint, including helpers exported only for unit tests. Audit of the six modules' runtime exports:

- `control.ts` — all `send*` actions: intended.
- `projects.ts` — `onProjects`, `sendAddProject`, `sendPickProjectDirectory`, `onOnboarding`, `onDriverReady`, `onRepoAutoMerge`: intended.
- `preferences.ts` — `onPreferences`, `savePreferences`, `patchPreferences`, `onProjectPresets`, `saveProjectPresets`, `onEditors`, `onNotifyChannels`, `saveDiscordCredentials`: intended.
- `quota.ts` — `onQuota`, `onAutoPm`, `sendAutoPmSweep`: intended (`noReading` is module-private).
- `devices.ts` — `checkDevices` only (`isDeviceCheck` is private): intended.
- `reads.ts` — the `on*` reads plus **`markCloudWaiting`, `markOtherHost`, `forDashboard`** — pure meta-transform helpers exported solely for `reads.test.ts` (verified: no other importer, and no client stub under `dashboard/rpc/`). They become live `POST /_rpc/markCloudWaiting` etc. — see Bugs.

The re-export block at the top (the typed surface the dashboard's `rpc/` stubs compile against) is consistent with the table for everything a client actually calls.

## Functions (low-level)

- **`RpcHandler` type** — `(...args: never[]) => unknown`; wide enough for every handler, and the mount JSON-parses the body into the spread args. Correct.
- **`RPC_HANDLERS`** — construction analyzed above. Duplicate export names across modules would silently last-write-win (`Object.fromEntries`); today the six modules share no names (checked), so no shadowing. Correct mechanically; see Bugs for the surface leak.
- **`RPC_EVENT_STREAM`** — `streamAgentEvents` alias for the mount's SSE endpoint. Correct.

## Bugs found

1. **L50–57 (fix belongs in `packages/framework/src/dashboard-rpc/reads.ts`, L101/L112/L118): test-only helpers are auto-registered as live RPC endpoints.** `reads.ts` exports `markCloudWaiting`, `markOtherHost` and `forDashboard` only so `reads.test.ts` can unit-test them; the exports-are-the-table rule turns them into `POST /_rpc/markCloudWaiting|markOtherHost|forDashboard`. That contradicts the surface's own spec — `dashboard-rpc/SPEC.md`: "Only names that are genuinely part of this surface answer"; `index.SPEC.md`: "A name that is not an RPC gets a 404" — these names answer 200 (echoing transformed caller JSON) or 500 (called with no args, `agent.target` on `undefined` throws). `markOtherHost` additionally defaults its second parameter to `hostname()`, handing any same-origin caller an equality oracle on the machine's hostname (`otherHost` set iff the supplied `host` differs from it). Exploitability is bounded by the mount's same-origin/rebind guards, so this is hygiene/spec conformance, not an open hole. Severity: minor. Fix: stop exporting the three helpers from `reads.ts` (exercise them through `onAgents`/`onRecentAgents`, or move them to a module outside the table); alternatively have `index.ts` collect only `on*`/`send*`/`save*`/`patch*`/`check*` names — but the unexport keeps the "the name IS the export name" story intact.
