Effort: 3
Uncertainty: 4

# [Plan] Goal: let TF fully *autonomously* work on quick-wins

Concrete plan to close the remaining gaps in the ticket → spike/plan → autonomous-implementation chain: a prompt-level plan→queue bridge, a model floor for merge-armed runs, and issue/doc hygiene.

## TLDR

Most of #1334 is already built. What's missing is (1) any instruction that turns a finished plan into a queued implementation — nothing reads a plan's `Effort:`/`Uncertainty:` verdict today — and (2) a model floor for merge-armed runs, because Haiku never calls `setReadyForMerge()` (0/5 on the #1334 evidence table), so auto-merge always ends withheld. Both fixes are small: two prompt edits and one guard in the daemon.

## Current state (what already exists)

The autonomy chain as shipped, per `packages/the-framework/src/auto-pm.ts`:

1. **Import**: `update-tickets` is already the *first* rotation job (`auto-pm.ts:308-313`; the doc comment at `:288` cites #1334 as the reason it leads). The ticket's "Requires adding the Update-tickets prompt to the routine task" is done — the issue checkbox is ticked.
2. **Plan**: the `spike-and-plan` fan-out (#1327) picks open/unplanned/unlocked tickets by priority (`daemon-services.ts:166-175`), pushes `.lock.md` claims (`ticket-locks.ts`), and spawns up to `autoPmConcurrency` pinned agents that each write a `.plan.md` with `Effort:`/`Uncertainty:` headers.
3. **Implement**: a non-empty `TODO_AGENTS.md` preempts the rotation; the drain job runs with `autoMerge: true` (`auto-pm.ts:339-345`), and the PR title carries `(fix #N)` from the ticket's `GitHub:` header (`run-handoff.ts` `sessionPrTitle`, shipped as `.changeset/squash-merge-closes-ticket-issue.md`) — so the issue's second checkbox ("squash-merge contains `(fix #1234)`") appears built too, just unchecked on GitHub.
4. **Deliberately removed**: the deterministic promoter `planned-quick-wins.ts` was deleted in `a0594fe1` (#1426) — it parsed the pre-#1420 `Effort: quick-win`/`Consensus: consensual` keys the 0-10 format never produces. brillout settled the direction on #1420: *"Isn't it sufficient to tell the agent what to do?"* — promotion should live in prompts, not code.

## Gaps

1. **The plan→queue bridge is unwritten.** The removal changeset says "[Triage quick] … now informed by plans' `Effort`/`Uncertainty`", and the removal commit title says "the planning agent queues its own quick wins" — but neither `prompts/presets/spike_and_plan.md` nor `prompts/presets/triage_quick.md` mentions `.plan.md` or the headers at all. Today a fresh consensual-quick-win plan just sits there until a triage agent happens to judge the ticket on its own.
2. **The model-tier blocker** (evidence on the #1334 thread, brillout acked "Sounds good"): merge-armed runs routed to Haiku never emit `setReadyForMerge()` (0/5; Sonnet/Opus/Fable 1/1 each, unprompted), so the practical default is auto-merge armed → always withheld → a human still finishes every run.
3. **Rotation latency** (minor): planning runs last in the rotation, so a newly imported ticket is triaged one or two ticks *before* its plan exists. If the spike agent queues its own quick wins (gap 1, option A), ordering stops mattering for quick wins — the drain preempts the rotation on the very next tick.
4. Related but out of scope here: merges currently land before CI completes — #1406, a repo-settings fix.

## Problems

- **P1 — where the plan→queue bridge lives** (uncertainty 5): spike agent vs. triage-quick vs. both; the two authoritative statements in commit `a0594fe1` point at different homes.
- **P2 — what thresholds mean "consensual quick-win"** (uncertainty 4): the 0-10 headers need a cut-off, and brillout's planned Effort/Uncertainty spike redesign may change the keys.
- **P3 — where the model floor goes** (uncertainty 3): code guard vs. prompt hardening; and which tier is the floor.
- **P4 — hygiene** (uncertainty 1): no meaningful alternatives.

## Solutions

**P1 — plan→queue bridge:**
- **A (recommended): the spike agent queues its own quick win.** Append to the stock `spike_and_plan.md` body (the fan-out pin at `auto-pm.ts:266-281` is *appended* to the stock prompt, so this rides along verbatim): after writing the plan, if it is a consensual quick-win, also append `- Implement tickets/<TICKET>.md following tickets/<TICKET>.plan.md` to `TODO_AGENTS.md` in the same commit, under the priority section matching the ticket's `Priority:`. The machinery already exists: the tick loop promotes finished runs' queues (`queue-promote.ts`) and then drains with auto-merge. Zero code, one rotation hop, matches both brillout's prompt-over-code preference and the `a0594fe1` commit title.
- **B (also do it — complements A): make `triage_quick.md` plan-aware.** One added line: when a ticket has a `.plan.md`, read its `Effort:`/`Uncertainty:` and only pick it as a quick-win if the plan says so. This sweeps the backlog of plans that already exist (A only covers plans written from now on) and makes the changeset's claim true.
- C: restore `planned-quick-wins.ts` adapted to the 0-10 headers (`git show a0594fe1^:…`). Deterministic and testable, but re-litigates a decision the maintainer made days ago — listed for completeness only.

**P2 — thresholds:**
- **Recommended: `Effort ≤ 2` AND `Uncertainty ≤ 1`**, spelled out in `spike_and_plan.md` only (single source; `triage_quick.md` just defers to "the plan says quick-win"). `ticketing_format.md` already defines Uncertainty 0 as "clearly no human intervention needed"; allowing 1 admits trivial variability without opening real questions.
- Stricter alternative: `Uncertainty = 0` exactly — safest, at the cost of fewer autonomous wins.
- Since the threshold lives in prose, tuning it later is a one-line prompt edit; if brillout's header redesign lands, only this one passage needs rewording.

**P3 — model floor:**
- **A (recommended): code guard where merge-armed runs start.** In `daemon-services.ts` `start()` (`:180-206`), when the job carries `autoMerge: true`, pass an explicit `model` that is at least Sonnet — i.e. if the resolved project/preference model is unset or matches `/haiku/i`, override with `sonnet` (constant `MERGE_ARMED_MODEL_FLOOR`). This is the direction the #1334 thread converged on ("a chooser that routes a merge-armed run to Haiku silently disables autonomy"). The CLI `--auto-merge` manual path (`cli.ts:515`) should share the helper.
- B: Haiku-proof the system prompt — the "required, the work is never merged without it" wording is already there and Haiku ignored it 5/5; harder path, keep only as a fallback.
- Small follow-up worth doing in the same PR (observability gap from the thread): record the selected model on the run meta/journal, so future tier evidence doesn't rely on memory.

## Considerations

- **Lock semantics**: #1420 wants one agent per ticket across planning *and* implementation, but drains still claim via queue entries rather than `.lock.md` (flagged in #1425). Option A keeps today's behaviour — the spike agent deletes its lock with the plan, the queue entry becomes the claim. Fine for now; the broader coordinator-lock idea stays with #1420.
- **Fan-out queue conflicts**: concurrent spike agents each append to `TODO_AGENTS.md` on their own branches; `promoteQueue`/`landPinnedEntry` (`queue-promote.ts`) already reconcile queues from finished runs, so this doesn't need new code — but it should be manually verified with two concurrent quick-win plans before calling the ticket done.
- **The withheld path stays the safety net**: even with the floor, a run that never signals `setReadyForMerge()` fails safe as a draft PR (#1390/#1392 gate) — autonomy never bypasses the gate, it just stops tripping over Haiku.
- **Prompts are build-time compiled** (`scripts/gen-prompts.mjs` → `prompts.generated.ts`): prompt edits need a rebuild + daemon restart + dashboard hard-refresh to take effect when dogfooding.
- **Docs drift**: `BUSINESS_LOGIC.md` F26 still describes the rotation without `update-tickets` — fix in passing.

## Implementation

1. `prompts/presets/spike_and_plan.md`: append the self-queue rule — "After the plan lands: if it concludes `Effort ≤ 2` and `Uncertainty ≤ 1` (a consensual quick-win), also add `- Implement tickets/<TICKET>.md following tickets/<TICKET>.plan.md` to `TODO_AGENTS.md` in the same commit, under the ticket's priority."
2. `prompts/presets/triage_quick.md`: add — "When a ticket has a `.plan.md`, trust its `Effort:`/`Uncertainty:` headers: pick it only if the plan concludes it is a consensual quick-win; a ticket without a plan may still be picked on your own judgement."
3. `daemon-services.ts` (+ helper, + tests): `MERGE_ARMED_MODEL_FLOOR = 'sonnet'`; apply when starting any `autoMerge: true` job with an unset/Haiku model; share with the CLI `--auto-merge` path. Record the selected model on the run meta.
4. `BUSINESS_LOGIC.md` F26: add `update-tickets` to the rotation description.
5. GitHub hygiene: verify one auto-merged PR title carries `(fix #N)`, tick the second checkbox on #1334, and comment there linking this plan.
6. End-to-end dogfood: create a throwaway trivial ticket → watch import → fan-out plan → self-queued entry → drain with auto-merge on a Sonnet-floored run → issue auto-closed. Verify the two-concurrent-quick-wins queue reconciliation while at it.

Steps 1–4 are one small PR. Step 6 is the acceptance test for closing #1334.
