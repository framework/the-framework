# Bug analysis: packages/framework/src/cloud-work.ts

## Business logic (high-level)

The adoption pass (#1601): a `web`-target run is a local wrapper that hands the task to claude.ai; the cloud session then works on a `claude/*` branch of its own naming, never the `tf-agent-*` branch the run was born on. This pass walks origin's `claude/*` heads, matches each waiting run by ancestry from its hand-off anchor (an empty commit unique to the run), records the branch and its PR onto the run's archive (one data-branch commit), and — when the run was armed for a PR the session never opened — opens the armed draft PR itself.

Key invariants, and whether the code upholds them:

- **Exactly-one match adopts** (`matches.length !== 1` → retry next pass): upheld — zero (nothing pushed / anchor object not local, since `for-each-ref --contains` fails and is caught as `''`) and ≥2 both do nothing.
- **48h window, applied at the store read**: `agents(cwd, now - CLOUD_ADOPTION_WINDOW_MS)` plus a re-check per run in `waitingRuns` (`Date.parse` of `startedAt ?? startedAtFromAgentId(id)`; `NaN` excludes). Consistent on both sides of the window.
- **"None" vs "could not tell"**: the PR listing goes through `.then(ok, err)` so a rejection becomes a reported failure, records the branch (still a fact), opens nothing, and the run is re-asked. Upheld; this is the double-draft-PR guard the SPEC calls out.
- **No PR over nothing**: the armed draft opens only when `head.sha !== run.cloudAnchor`. A branch that *is* the anchor is re-matched every pass inside the window (patch stays empty → `continue`), which costs one PR listing per pass; bounded by the window, acceptable.
- **Foreign branch protection**: a run whose record names neither its birth branch nor the matched head is skipped entirely (`!onBirthBranch(run) && run.branch !== branch`), so a PR is never recorded against a branch it does not live on.
- **Fetch semantics**: one `fetch --prune origin +refs/heads/claude/*:refs/remotes/origin/claude/*` per pass — pruned so deleted origin branches stop matching; standing remote-tracking refs so GC keeps the objects. A fetch failure (no remote / offline) returns an empty result without throwing, per spec.
- **Never throws**: `agents`, fetch, and `for-each-ref` are all caught. `prs` rejection is folded into a result. The two seams that are *not* wrapped are `patch` and `openPr`; both defaults (`patchArchivedAgentOnDataBranch`, `openRemoteBranchPullRequest`) return result values rather than throwing (verified in their sources), and the daemon service wraps `adopt(...)` in a `.catch` anyway. Reliance noted, not a bug.

Concurrency/ordering: the service (`startCloudWorkAdoption`) has no timer (the daemon clock ticks it), joins overlapping ticks on one `inflight` promise (so awaiting `tick()` means the pass finished), checks `stopped` per project and at tick start. `stop()` mid-pass lets the current project's adoption finish — consistent with the sibling sweeps.

## Functions (low-level)

- `CLOUD_ADOPTION_WINDOW_MS` (48h) — matches SPEC ("started within the last 48 hours"). Correct.
- `onBirthBranch(meta)` — `branch === undefined || branch === agentBranchName(id)` (`tf-agent-<id>`). Matches how a fresh web run's meta is written (`branch: tf-agent-<id>`). Correct.
- `prArmed(meta)` — `handoff?.pr !== false`: absent meta.handoff means armed, matching the store's documented reading ("Absent means an older agent, which the reader treats as armed"). Correct.
- `waitingRuns(agents, now)` — filters to `web`, not `running`, has `cloudAnchor`, inside the window; then owed = still on birth branch, OR (pr unknown ∧ armed ∧ `done`). Edge cases: a `stopped`/`failed` web run gets its branch recorded (first disjunct) but never the armed PR (second requires `done`) — matches the SPEC's "the agent finished". An unarmed adopted run drops out (both disjuncts false), per spec. `startedAt` is required on `AgentMeta`, so the `startedAtFromAgentId` fallback is belt-and-braces. Correct.
- `fetchCloudHeads(git, cwd)` — the one fetch; refspec destination named explicitly so a `--single-branch` clone still gets standing refs. Correct.
- `headsDescendingFrom(git, cwd, anchor)` — `for-each-ref --contains=<anchor> --format='%(objectname) %(refname)' refs/remotes/origin/claude/`; errors (anchor object not local) caught as no match. Line regex `^([0-9a-f]{40,64}) (.+)$` handles SHA-1 and SHA-256; the `startsWith(CLOUD_HEAD_PREFIX)` re-check makes a stray ref harmless. Verified against real git by the integration test. Correct.
- `adoptCloudWork(cwd, deps)` — the pass. Per-run flow verified against the SPEC: match → foreign-branch guard → PR listing (filtered by run start via `pickAgentPr(found, since, 'latest')`) → armed-draft open (only on `done`, armed, listing-succeeded-empty, head beyond anchor) → single patch (`branch` first time only, `pr` only when `run.pr === undefined`) → empty patch writes and announces nothing. A failed patch is a reported failure and retried. One nuance: `pickAgentPr` returns an *open* PR regardless of `since` (the `since` filter only applies to closed PRs); on a reused `claude/*` branch name, a predecessor's still-open PR would be adopted — but GitHub allows one open PR per branch and that PR now points at this branch's content, so recording it is the right answer; the "filtered by the run's start" comment slightly overstates. Another nuance: when `run.pr` is already recorded but the branch is being adopted, the result/log still name the freshly listed PR (informational only; the archive is not overwritten). Correct.
- `startCloudWorkAdoption(opts)` — per-project loop with `stopped` re-check, `.catch(() => [])` on `projects`, `.catch` on `adopt`, log lines exactly as the tests pin (`draft PR` wording for opened, failure text passthrough). `inflight ??=`/`finally` join semantics correct; `stop()` makes later ticks resolve immediately. Correct.
- Interfaces (`CloudAdoption`, `CloudWorkResult`, `CloudWorkDeps`, `CloudHead`, `CloudWorkAdoption`, `CloudWorkAdoptionOptions`) — shapes match all call sites (daemon-services wiring checked). Correct.

Edge case worth recording (not a bug): `openRemoteBranchPullRequest` can return `{ ok: true }` with no url/number (gh printed no URL); the pass then records only the branch and does not report a failure, and the next pass finds the now-existing PR via the listing — no duplicate is possible because the listing is consulted first.

## Bugs found

None found.
