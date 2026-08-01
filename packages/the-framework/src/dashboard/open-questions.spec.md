Every session's open question with its full gate, for the launcher's answer-in-one-place hub (#1455 item 4).

## TLDR

- `buildOpenQuestions(projects)`: per project, every live run that is `running` with a `pendingChoice` — the gate's FULL `ChoiceRequest` re-read from the run's own event log — longest-waiting first (`updatedAt` ascending). Exposed as the `onOpenQuestions` telefunction.
- `openChoiceRequest(events, gateId)`: the still-open request under that id — its `choice` event with no later `choice-resolved`. The sibling of live-run.ts's `openGate`, kept whole (multi, recommended, confirm, option detail) because an answering *panel* needs everything the event carried, where chat needed a slimmed copy.
- Injectable seams (`OpenQuestionsDeps`: `liveRuns`, `events`) for disk-free tests.

## Problems

- `RunMeta.pendingChoice` carries only `{id, title}` — all the rail's badge ever needed — so the options are only in the `choice` event, and surfacing an answerable card means reading each parked run's log. Read through the store's own reader so this surface cannot keep a drifted copy of the torn-line policy (same argument as live-run.ts).
- The log is read from `meta.cwd`, not the project root: a daemon-spawned run logs in its own worktree.

## Decisions

- A pending gate whose log no longer shows it open (already resolved, log unreadable) is skipped: offering an answer the daemon would refuse is worse than one card fewer.
- Longest-waiting first: the run blocked on its human the longest is the one to unblock first.
- Forgiving like every cross-project rollup — an unreadable project, run list or log contributes nothing.
