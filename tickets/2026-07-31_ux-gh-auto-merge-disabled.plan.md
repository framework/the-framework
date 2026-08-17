Effort: 1
Uncertainty: 2

# [Plan] UX when GH auto-merge is disabled

Most of what #1417 asked for has already landed; what remains is updating the launcher warning, whose copy still describes the pre-fix hazard.

## TLDR

The two concrete asks in the ticket are done in the codebase:

1. **The broken probe (#1443) is fixed.** `ghRepoAutoMerge` (`packages/the-framework/src/dashboard/gh.ts:334`) probes `gh api repos/{owner}/{repo}` and reads `allow_auto_merge`, exactly as the ticket prescribes — with tests (`gh.test.ts:212`), a 5-minute cache (`cachedRepoAutoMerge`), the `onRepoAutoMerge` RPC, and the warning wired into `StartAgentForm.tsx:115-125` (tested in `StartAgentForm.test.tsx:233-271`). The "could not say ⇒ no warning" stance is preserved and tested.
2. **The OP's auto-merge mechanism (#1418) is implemented** — as a polling CI watch, not a webhook (rationale in `ci-watch.SPEC.md`: a local daemon has no public address GitHub could call). The daemon runs the watch every ~minute (`daemon-services.ts:392`), and the armed-handoff merge path passes `whenUnarmed: 'watch'` (`agent-handoff.ts:647,687`), so on a repo without GitHub auto-merge an armed merge defers to merge-on-green instead of landing before CI. The human "Merge" button (`mergeAgentPr`) still merges directly, which is the intended "land it now".

**What remains: the warning copy is now stale.** `StartAgentForm.tsx:240-247` still tells the user "an auto-merged session lands its PR immediately — CI is not awaited". That was true before the CI watch; today the armed path answers `watched` and the daemon merges on green. The warning now claims a hazard that no longer exists, which misinforms exactly the first-impression moment the ticket says matters.

## Problems

- **What should the message now say?** (uncertainty 3) The degradation changed shape rather than disappearing: the local watch merges on green only while the daemon is running, and without a required check GitHub itself would still accept a red direct merge from other tools. Enabling "Allow auto-merge" + a required check is still the sturdier setup. So the message should shift from "danger: lands before CI" to an informational "handled locally; enable Allow auto-merge for the robust server-side version".

## Solutions

For the message, in order of preference:

1. **Reword to match reality (recommended):** keep the same trigger (`known && !allowed` while merge is armed), but say: this repo has GitHub auto-merge disabled, so TF's local daemon will merge the PR once checks pass ("merge on green") — works, but only while the dashboard/daemon is running; for a server-side guarantee, enable **Allow auto-merge** and mark a check as required. Consider downgrading styling from `text-warning` to a muted informational tone, since the default path is no longer unsafe.
2. **Remove the notice entirely:** defensible now that the watch closes the hazard, but loses the nudge toward the more robust native setup — and the daemon-offline caveat is real, so silent is worse than informative.
3. **Keep the warning text as is:** wrong — it describes behaviour the code no longer has.

## Considerations

- The comment above the warning (`StartAgentForm.tsx:237-239`) and the one at `StartAgentForm.tsx:115-118` restate the outdated "degrades to an immediate direct merge" story — update both alongside the copy.
- `StartAgentForm.test.tsx:233-271` asserts on `/auto-merge disabled/` and `/Allow auto-merge/`; keep those anchors (both survive the reword) and adjust any assertion that pins the "lands immediately" phrasing.
- Do not touch the "could not say ⇒ render nothing" behaviour, the merge-armed-only probing, or the remote-device exclusion — all deliberate and tested.
- The terminal already explains the new behaviour per-handoff ("✓ merge on green: the daemon merges the PR when its checks pass", `terminal.ts:110-111`); the reworded launcher note should use the same "merge on green" vocabulary so the two surfaces agree.
- Ticket housekeeping: with the copy fixed, #1417's scope is fully covered — close the GitHub issue and delete this ticket (plus this plan) in the implementing PR.

## Implementation

1. Reword the `autoMergeDisabled` notice in `StartAgentForm.tsx` per Solution 1; update the two adjacent comments; keep the trigger condition unchanged.
2. Update `StartAgentForm.test.tsx` expectations to the new copy (keep the no-warning-on-unknown and no-probe-when-unarmed tests untouched).
3. Run the dashboard package tests; done. No backend change needed.
