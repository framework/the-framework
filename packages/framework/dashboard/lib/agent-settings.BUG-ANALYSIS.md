# Bug analysis: packages/framework/dashboard/lib/agent-settings.ts

## Business logic (high-level)

The shared vocabulary for the three parts of a start (agent-settings.SPEC.md): per-driver model
lists (order = menu order), run-target labels, and `describeAgentSettings` — the one-line
"driver · model · run target" summary several surfaces show. Audit against the SPEC:

- Model lists match the SPEC's rosters and order (Claude: Fable/Opus/Sonnet/Haiku — Haiku present
  by design, MEMORY.md: the dashboard warns but never blocks; Codex: GPT-5 Codex/GPT-5/o3).
- **A model is never invented**: the pinned model is looked up only in the *selected* driver's
  list; a miss (other driver's model, or nothing pinned) reads `NO_MODEL_PINNED` ("the CLI's own
  default") — never the first entry. Matches #1143 and the SPEC bullet.
- Unrecognised stored driver → Claude Code (via `isDriverName` guard); missing target → 'local'
  ("This machine"). Both spelled out in the SPEC's last bullet.

Edge considered: a stored `target` outside the `AgentLocation` union would index
`RUN_TARGET_LABELS` to `undefined` and the summary would read "… · undefined". The type forbids
it, values come from the dashboard's own writes, and MEMORY.md's zero-migration stance says not
to defend against stale foreign values — reliance noted, not a bug.

## Functions (low-level)

- `DRIVER_MODELS` — data; every `value` a real model id per the comment. Correct.
- `NO_MODEL_PINNED` — the shared wording; exported so surfaces cannot drift. Correct.
- `RUN_TARGET_LABELS` — total over `AgentLocation`. Correct.
- `describeAgentSettings(preferences)` — pure; `driver` guarded, model matched by exact `value`
  equality (`undefined` model never matches any entry → falls to NO_MODEL_PINNED), joined with
  " · ". Verdict: correct.

## Bugs found

None found.
