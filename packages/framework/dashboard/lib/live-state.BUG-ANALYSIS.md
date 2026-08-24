# Bug analysis: packages/framework/dashboard/lib/live-state.ts

## Business logic (high-level)

Pure projections over an agent's `events.jsonl` stream: open gates, pushed views, liveness, settledness, outcome, the publishing window, and the Actions/cloud links. The SPEC (`live-state.SPEC.md`) pins the segment rules: liveness, outcome and the publishing window are answered from the *current segment* (everything after the last `session` boundary); gate/view folds run over whatever slice the caller hands in; arming (`handoff-armed`) is agent-level config, so the latest one anywhere in the feed wins.

Key invariants checked:

- **Segmenting.** `currentAgentEvents` cuts at the last `session` event, whole feed when none. Used internally by `isAgentActive`, `agentOutcome`, `isPublishing`. Callers own the cut for `pendingChoices`/`agentViews`/`agentSettled`: `use-live-events.ts` L144 scopes the project-level accumulated feed (`agentId ? events : currentAgentEvents(events)`), and `App.tsx` L257 re-cuts before `agentViews` (deliberate per its comment — the rail's views stay scoped to the newest segment even though the per-agent feed no longer is). So the whole-feed iteration in those three functions is by design, not leakage.
- **Cross-agent leakage in the accumulated live feed.** A previous agent's unresolved gate could in principle survive into the next agent's view if that agent never got an `end` — but the store writes a surrogate `end` for a dead agent (#1359, referenced in the JSDoc), and the no-agentId path is pre-scoped anyway, so the `end`-clears-gates rule plus caller scoping covers it.
- **Publishing window.** `isPublishing`: current segment must contain a clean `end`, contain no `handoff` report, and the latest `handoff-armed` anywhere must have `push === true`. Matches SPEC ("the handoff report of an earlier segment never closes the current window"; "the most recent arming applies wherever it sits") and test #1450. The whole-feed arming scan could in theory pick up a *previous agent's* arming in the accumulated project feed, but that path only ever receives the current segment (scoped upstream), and every agent's start re-emits `handoff-armed` (cli.ts `announceHandoff`), so the theoretical cross-agent arming pickup has no reachable trigger.
- **Meta twin.** `isMetaPublishing` mirrors the same three conditions off `AgentMeta` (`status === 'done'`, `handoff?.push === true`, `handoffReport === undefined`). Matches SPEC's meta paragraph.

## Functions (low-level)

- `pendingChoices(events)` — Map keyed by gate id; `choice` opens/replaces, `choice-resolved` deletes, `end` clears all. Insertion-order output = fire order; a re-fired gate keeps its original position in the Map (Map `set` on an existing key preserves order) — acceptable, SPEC says "replaces the earlier one in place". A `choice-resolved` for an unknown id is a no-op (delete on missing key). Verdict: correct.
- `agentViews(events)` — Map keyed by view id, `set` updates in place, first-seen order preserved. Discriminant stripped via rest spread so new event fields flow through (pinned by the test). Verdict: correct.
- `isAgentActive(events)` — current segment non-empty and end-free. Empty feed → false; resumed feed (`[session, end, session, log]`) → true. A resume that has appended only its `session` boundary counts as active (segment length 1, no end) — right, the resume has started. Verdict: correct.
- `agentSettled(events)` — last-writer fold: `settled` sets, driver `start` clears, `end` clears. Runs over the caller's slice; across a resume boundary the previous segment's `end` already cleared it. Verdict: correct.
- `agentOutcome(events)` — first `end` of the current segment or undefined. At most one `end` per segment by construction (`agent.ts` emits exactly one). `stopped: end.stopped === true` normalises the optional flag; `detail` only present when defined (so `toEqual` comparisons stay clean). Verdict: correct.
- `isPublishing(events)` — see above. Note the arming loop iterates `events` (whole input), deliberately wider than `current`. `end.ok` must be true; unclean/stopped ends → false. Verdict: correct.
- `isMetaPublishing(meta)` — three-way conjunction; `handoff` absent → false (affirmative-arming rule, prevents pre-handoff archives reading "publishing…" forever). Verdict: correct.
- `actionsRunUrl(events)` — scans driver `action` events for `^run (https?://\S+)$`; last match wins. A tool action labeled e.g. `run tests` does not match (no `https://`). Verdict: correct.
- `cloudSession(events)` — same shape, regex anchored to `https://claude.ai/code/session_<alnum>` with an optional non-space tail folded into the url; id captured separately. Last wins. Verdict: correct.
- `currentAgentEvents(events)` — reverse scan for the last `session`, slice from it (inclusive); no boundary → whole feed (start stays 0). Off-by-one checked: the boundary event itself is included in the segment, which the tests pin (`session`-first output). Verdict: correct.

Edge cases relied on rather than handled (noted, not bugs): every agent death eventually gets a surrogate `end` from the store; every agent start re-emits `handoff-armed`; the feed passed for a specific agent is that agent's own journal.

## Bugs found

None found.
