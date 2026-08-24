# Bug analysis: packages/framework/dashboard/components/AgentFeed.tsx

## Business logic (high-level)

Thin presentational wrapper around `EventList`: choose between placeholder and log, and prepend
the lost-stream banner. Checked against `AgentFeed.SPEC.md`:

- **Lost stream announced** — `lost` renders the warning banner in both the empty and populated
  branches, wording separates "connection died" from "agent went quiet" and says the agent keeps
  running. ✓
- **Live follows / finished static** — pure prop plumbing: `stick` defaults true (live),
  `openAt` forwarded only when set; `AgentView` passes `{stick:false, openAt:'end'}` for a
  non-live feed. The actual scroll contract lives in `EventList`; nothing here can break it. ✓
- **Gates stay answerable** — `projectId` is required and `agentId` forwarded, so `EventList`
  can always render a `choice` event as an answerable panel; the type makes the #846 downgrade
  impossible for any caller. ✓
- **Empty states** — `emptyLabel` defaults to the live wording; the finished caller overrides it
  ("This agent has no events."). ✓

Edge cases: `events` flipping empty→populated swaps placeholder for list (remount of EventList —
its own openAt/stick logic initializes then, which is exactly when it should); `tail` is only
forwarded in the populated branch, so a web agent's mirror box is absent while the feed is empty
— defensible ("rides the tail of the scroller" needs a scroller; the CloudAgentNotice above the
feed still points at the cloud session), transient (a web run always has opening events), so not
reported as a bug. The `{...(tail ? { tail } : {})}` guard is against `undefined`, not against a
self-nulling element (the `CloudMirrorRow` element is always truthy and nulls itself) — correct
either way.

No state, no effects, no subscriptions — nothing to leak; `lost=true` with an empty feed shows
banner + placeholder together, which is coherent.

## Functions (low-level)

- **`AgentFeed(props)` (L11)** — inputs as typed; output: banner? + (placeholder | EventList).
  Off-by-one/none: `events.length === 0` is the only branch point and both sides render the
  banner. Conditional spread keeps `EventList`'s own defaults for `openAt`/`tail` when unset
  (passing `openAt: undefined` explicitly could otherwise defeat a default parameter — the
  spread pattern avoids that correctly). Verdict: correct.

## Bugs found

None found.
