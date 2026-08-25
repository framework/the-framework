# Bug analysis: packages/framework/src/dashboard/overview.ts

## Business logic (high-level)

The cross-project Overview (#437) plus three sibling rollups: recent agents pooled (#1648), per-project ticket lists (#1144), and the hot-tickets shortlist (#1139/#1117). Everything is forgiving per project (each read `.catch`'d), matching the "broken project is silently absent" rule.

- **Working now**: every project's live agents with `status === 'running'` (one per worktree, #738), plus `web`-target agents whose `cloudRunState` is `in-cloud`/`waiting` (#1668) — checked against `cloud-run-state.ts`: it returns a state only for `status === 'done'` web runs, so a web run's still-running local half cannot be double-listed by the two loops. Web runs are deduped across projects via `cloudSeen` (shared archives); live agents need no such dedupe since `readLiveMetas` reads the checkout's own worktrees (verified in agent-store.ts). `host` is attached only when it differs from this machine's (#1648). Sorted by `updatedAt` desc (ISO localeCompare — valid).
- **Backlog**: sum of `ProjectQueue.open` from `collectQueue` (itself per-project forgiving).
- **Recents**: projects with `lastActivityAt`, desc, top 5.
- **Hot tickets**: lanes with precedence in-progress (implementing by a *running* agent's recorded `meta.ticket`, or `planned`) > ai-queue (open queue entry with a leading `tickets/` link) > high-priority (numeric ≥ 7 on the ticket format's 10-0 scale — deliberately not P0/P1); everything else dropped; stable lane-first sort preserves file order within a lane; capped at 60 after lane sort (so high-priority trims first — deliberate). Implementing is matched per project (`Map` rebuilt per project) since ticket paths are only unique per repo — key format `tickets/<file>` matches how `AgentMeta.ticket` is recorded (verified: agent-store.ts documents `tickets/<file>.md`, and the `ticket` event stores `event.path`).

## Functions (low-level)

- **`buildRecentAgents`** — pools, sorts by `startedAt` desc, dedupes by `agent.id` (`!seen.has(id) && seen.add(id)` — `add` returns the truthy Set), caps at 30. Ties (identical `startedAt` from a shared archive) resolve by stable sort → registry order → "first project keeps it", as specced. Correct.
- **`collectAllTickets`** — `Promise.all`, per-project catch to `[]`, keeps empty projects (import stays reachable). Correct.
- **`isHighPriority`** — `parseInt` base 10; NaN → false; `'7.5'` → 7 → high (harmless). Words rejected as specced. Correct.
- **`ticketBucket`** — precedence exactly as documented; `implementing` beats a plan-less ticket. Correct.
- **`queuedTicketFile`** — `QUEUE_LEADING_LINK` requires the link at entry start (mirrors the dashboard's `queueEntryLabel` per the comment); strips the `tickets/` prefix; `./tickets/…` or a mid-entry link returns undefined (specced: only a leading link counts). Correct.
- **`buildHotTickets`** — builds the queued-file sets skipping `done` items; per-project implementing map filtered to `status === 'running'`; unmatched agentId omitted from the row. Note `deps.queue ?? (p => collectQueue(p))` is not `.catch`'d — `collectQueue` cannot reject (internal catches), so acceptable reliance. Correct.
- **`buildOverview`** — as analyzed above. Small observations, none bugs: the default `waiting` predicate (`bridgeQuestions().get(id) !== undefined`) counts a question whose answer is already queued as still "waiting" (slightly stale badge until the answer lands — consistent with "the bridge holds a question"); a `web` run entry reuses `entry()` so it carries `status: 'done'` alongside `cloud`, which the interface documents. Correct.

## Bugs found

None found.
