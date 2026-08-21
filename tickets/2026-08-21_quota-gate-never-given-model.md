Priority: 7
GitHub: [#1619](https://github.com/gemstack-land/the-framework/issues/1619)

# The quota gate is never given a model, so runs start on a model whose own week is spent

## TLDR

`quotaBoundaryStatus` accepts a `model` and drops every `week-model` window when it isn't given one — and the single production caller (`dashboard/quota.ts:60`) passes none. So the gate only ever sees the all-models week. With the model pref on Fable at 100% while the all-models week sits at 54%, `quotaHeadroom` says `start: true` and every run it starts dies at the first API call with "limit reached".

## Why it matters

Both self-starting paths consume that model-blind boundary — auto PM (`daemon-services.ts:189`) and the CI-watch fix (`daemon-services.ts:309-310`) — so unattended work keeps launching sessions that cannot make a single call. The account looks like it has headroom because in aggregate it does, just not on the model the work will run on.

## What a fix has to decide

The daemon already knows the model (`agentOptionsFromPreferences`, `agent-options.ts:65`), so the value is available at both gates. The open choice:

- A **second, model-aware boundary computed per start**, leaving the panel's source untouched. Keeps #960's "one source" promise honest by making the second one visibly a different question.
- Or `read()` grows a model argument that the panel passes as `undefined`.

Also to be stated in the same pass: what a run should do when the model's week is blocked but the all-models week is fine. Standing down until the model's reset is correct; what happens today is a session dying at the API with four stacked "limit reached" cards, which is not standing down.

Note this is *not* the unbuilt model floor. A floor is about which model unattended work should use; Fable was the user's explicit setting here and the run should have been held, not silently upgraded.

## Same shape as #1616

A capability that exists, is documented, is unit-tested (`quota-boundary.test.ts:100-113`), and is never wired at the one production call site that needs it — there `PR_VIEW_FIELDS` never asked `gh` for `createdAt`. Both stayed hidden because the tests inject the value the production path fails to supply. Worth asking whether this class deserves a standing check: an optional parameter only tests ever pass is not a seam, it's a feature that was never turned on.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1619](https://github.com/gemstack-land/the-framework/issues/1619), created 2026-08-21, no labels, 0 comments. PR [#1620](https://github.com/gemstack-land/the-framework/pull/1620) is open against it.
