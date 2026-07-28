Builds the `RunSnapshot` routing decides against (#680) from a project's on-disk run state: the live run plus its still-open choice gate.

## TLDR

- `snapshotLiveRun`: first `running` meta from `readLiveMetas` (newest-first), plus its parked gate resolved from the run's event log; forgiving throughout — chat must never fail on unreadable run state.
- `openGate(events, gateId)`: the gate's `choice` event with options, unless a later `choice-resolved` for the same id closed it — so a chat reply never answers a question the dashboard already resolved.

## Problems

- The gate's options are not on the run meta: `pendingChoice` carries only id and title (all the dashboard rail needed), so answering "2" from chat requires reading the run's event log — through the store's own reader, so this surface cannot keep a drifted copy of the torn-line policy.

## Decisions

- Known constraint (#945): chat models ONE live run per project, and this picks the newest running one, which is not necessarily the one the user means. An accepted MVP limit, not an oversight — the real fix is letting the bot list and target runs; the module comment explicitly says do not "fix" the pick order here, since a different deterministic pick is no better when the user cannot choose.
