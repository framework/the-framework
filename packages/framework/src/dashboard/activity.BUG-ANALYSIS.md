# Bug analysis: packages/framework/src/dashboard/activity.ts

## Business logic (high-level)

The "new activity" feed (#627): one item per agent across every registered project's 20 most
recent runs — `started` while running, `finished` once terminal (carrying the terminal status) —
newest first, plus the `whole` list (#1623) that keeps the notifiers from mistaking "could not
read" for "quiet project". Identity/diff live in `keys.ts` (`activityKey = kind:project:agent`),
re-exported here. Discord delivery collapses items into one webhook message.

Invariants checked against `activity.SPEC.md`:

- **One item per agent, current state**: `activityFor` maps `running → started`, everything else →
  `finished` with `status` attached. `AgentStatus` is exactly `running|done|stopped|failed`, so
  "else is terminal" is total. ✓
- **Exactly-once per transition**: guaranteed by `activityKey`'s kind prefix plus the notifiers'
  baselines (out of scope here); this module only has to keep the keys distinct and stable, which
  it does. An agent that starts and finishes between polls is only ever seen terminal → one item. ✓
  (Continuation runs (#762) re-entering `running` reuse the same `started:` key, so a *second*
  start of the same id never re-announces — consistent with "each transition announces exactly
  once" per key, arguably even desirable; noted only.)
- **Could-not-look vs nothing-happened**: `readAgents(...).catch(() => undefined)`; `undefined`
  skips the project *and* omits it from `whole`; an empty array still pushes to `whole`. Matches
  #1623 exactly. ✓
- **Cap**: `slice(0, RECENT_RUNS)` per project bounds the finished-set; live metas are prepended
  by `readAllAgents` so a running agent cannot be capped out. The doc's premise ("a running agent
  is always newest") holds for the cap's purpose because live rows precede archived rows in the
  input regardless of timestamps. ✓
- **Ordering**: sort by `updatedAt` desc via `localeCompare` on ISO strings; absent `updatedAt`
  sorts last. ISO-8601 strings with the same offset (always `Z` here) compare chronologically. ✓
- **Discord**: one item → `📣 Activity (<project>): <line>`; several → counted summary, one line
  each; `[]` → resolve `true` with no POST; delivery result surfaced. Over-long batches are
  clamped inside `postDiscordWebhook` (2000-char cap with a truncation marker), so a big batch
  degrades rather than silently posting nothing (#940). ✓
- Failure isolation: nothing here throws — the per-project read is caught, the webhook transport
  catches network errors and non-OK statuses.

Data-branch nuance: archives synced from other machines (#1648 `host` field) flow through
unfiltered, so another machine's runs produce activity items here. The SPEC's cross-machine
sharing rationale ("the data branch is shared precisely so other machines' runs show up") makes
that intended.

## Functions (low-level)

- `RECENT_RUNS = 20` — bound; consistent with the SPEC's "20 most recent". Correct.
- `Activity` interface — fields are exactly what a notification line needs; `status` only on
  `finished`, `updatedAt` optional. Correct.
- `activityFor(project, agent)` — pure mapping; conditional spreads keep absent fields absent
  (deep-equal-friendly for the tests). Correct.
- `buildActivity(projects, deps)` — sequential per-project loop (N registry entries; fine),
  forgiving read, cap, sort, `{items, whole}`. Correct.
- `activityLine(item)` — `▶️ started:` / `❌`/`⏹️`/`✅ finished:` with `title ?? 'a session'`.
  Exhaustive over statuses (`done` and any future terminal fall to ✅). Correct.
- `postActivityDiscord(webhook, items, fetchImpl)` — empty short-circuit `true`; single vs
  counted-summary message; delegates transport. `items[0]!` is guarded by the length check.
  Correct.

## Bugs found

None found.
