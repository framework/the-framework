Effort: 2
Uncertainty: 5

# [Plan] An Actions agent is told two branch names

What happens today to an Actions agent's branch, checked against the code on main (9bb62321), and a proposed fix that waits for the maintainer's pick.

## TLDR

The work never gets lost. It always lands on `claude/<session id>`, and the agent's `agent-<name>` branch dies with the runner. The defect is the naming and a pointless instruction. Proposal: pass `branchPrefix: 'agent-'` in `cli.ts`, and tell an Actions agent to commit on the branch it is on instead of creating one. Maintainer's call first: the ticket says so, and the branch names show up in users' branch lists.

## What the code does today

- `packages/framework/src/cli.ts:1136` builds `actionsConfig` with no `branchPrefix`. So `ActionsSession` (`packages/agent-driver/src/actions.ts:123`) names the run branch `claude/actions-<n>-<tag>`. It passes that name to every dispatch as the `branch` input (`actions.ts:176`).
- The system channel gives every agent outside a daemon-made checkout `prompts/branch_yourself.md` (`prompts/LOGIC.md`, step 3). A GitHub Actions runner is one of those agents. The file says: `git checkout -b agent-<SESSION_NAME>`, then commit there.
- `.github/workflows/framework-agent.yml` ("Push the run branch") commits anything left uncommitted. It then pushes `HEAD:refs/heads/$RUN_BRANCH`. HEAD is whatever branch the agent checked out, so the agent's `agent-<name>` commits get pushed under the `claude/…` name. The `agent-<name>` branch itself is never pushed. It disappears with the runner.
- The next turn is dispatched with `ref: this.branch`, which is the `claude/…` branch (`actions.ts:182`). On the fresh runner, the agent runs `git checkout -b agent-<name>` again from there, and the push goes back to `claude/…`. So the turns chain correctly.
- Result: the work is always on `claude/<session id>`. It is never split between two branches. The ticket's worry ("which one carries the work depends on the workflow") only applies to a user's own workflow that pushes a different ref. The shipped one does not.

## Corrections to the ticket

- "Cloud agents end on one `agent-<name>` branch" is not true on main. A web (cloud) session also works on a `claude/*` branch of its own naming. `packages/framework/src/cloud-work.ts` adopts that branch afterwards by matching origin's `claude/*` heads to the run's anchor. So Actions is not the only target whose branch differs from `agent-<name>`.
- The `@gemstack/skill-branches` reclaim (`reclaim.ts`, `cli.ts:204-208`) works on local checkouts under `.branches/`. Its birth branch is `agent-<id>`. An Actions run has no work in a local checkout: its work is only on origin. So "reclaim never looks at it" loses no work. It only means nothing lists or cleans up `claude/actions-*` branches. Before building, check whether the daemon creates a local checkout for an Actions agent at all.

## Options

1. (a) Set `branchPrefix: 'agent-'` in `cli.ts:1136`. Branches become `agent-actions-<n>-<tag>`. That follows the `agent-` convention, but not the agent's own session name. Uncertainty 2.
2. (a') Also let the agent's name win: the workflow pushes HEAD to the agent's own branch name, and the driver reads that name back from the artifact (`artifact.branch` is already read, `actions.ts:163`). The next turn would then dispatch from `agent-<name>`, and the session would have to follow a branch that can change between turns. Uncertainty 5. It adds a moving part for a cosmetic gain.
3. (b) Drop the branch instruction for Actions. The system prompt would pick a variant of `branch_yourself.md` for the actions target: "commit on the branch you are on; the workflow pushes it". The rename step goes away and nothing is left that contradicts the workflow. Uncertainty 1.
4. (c) Leave it as is and add a line to `framework-agent.LOGIC.md` saying the agent's branch name is replaced by the run branch. Uncertainty 0.

## Recommendation

(a) + (b), and not (a'). The pushed branch follows the `agent-` prefix, and the agent is no longer told to do something the workflow undoes. If web runs should follow the same convention, open a separate ticket: that path (`cloud-work.ts` adoption) is a different mechanism.

## Implementation (once picked)

1. `packages/framework/src/cli.ts:1136`: add `branchPrefix: 'agent-'` (or change the default in `actions.ts:123` and its doc comment at line 87, since the framework is the only caller). Update `actions.test.ts` around line 182 if the default changes.
2. `packages/framework/src/system-prompt.ts`: step 3 takes the target. For `actions`, send `prompts/branch_actions.md` (a new file of one or two sentences) instead of `branch_yourself.md`. Add a test that pins it.
3. Update `prompts/README.md`, `prompts/LOGIC.md` (step 3 and the TL;DR bullet), `framework-agent.LOGIC.md` and `actions.LOGIC.md` to state exactly what the code does.
4. The dashboard and `cloud-scratch-refs.ts` look for `claude/*` in places. Check that none of them expects an Actions branch there before changing the prefix (`git grep "claude/"`).

## Considerations

- The project has zero users, so there is no migration for existing `claude/actions-*` branches. They can be deleted by hand.
- The new direction (agent-scheduler; the dashboard as a view of files) may drop `--run-on actions` entirely. If it does, (c) or closing the ticket is the cheapest answer. Ask the maintainer that question together with the pick.
