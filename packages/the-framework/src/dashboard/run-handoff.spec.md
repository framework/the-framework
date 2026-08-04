The git handoff: read what a session produced, decide whether it is publishable, then push, open the PR, and (when armed and authorized) merge.

## TLDR

- **Branch-addressed, not worktree-addressed**: the common end state has no worktree, and a checkout-based read would fall back to the project root and report the user's own dirty files as the session's.
- The auto handoff fires from settle's success path only; a user-stopped run and the failure path never reach it. Skip reasons are reported as events — a daemon-spawned run's stdout reaches nobody, and silence would read as "ran and did nothing".

## Decisions

- **Empty runs are never published, and the files decide, not the commits**: empty = zero commits *or* every changed file under `.the-framework/`. Branches of pure bookkeeping sweeps have commits and still nothing to hand off — publishing them produced junk PRs of paper trail.
- **No PR number is ever stored.** Every surface re-resolves the PR live from a candidate ladder — recorded branch → session-name branch → run-id branch — filtered by: an open PR always counts (GitHub allows one open PR per head); a closed one counts only if created after the run started (oldest such). This is what stops a reused pinned branch (routine jobs) from wearing a two-day-old merged PR as its own.
- The auto path uses the **uncached** PR lookup deliberately: the read-through cache answers "pending", which is right for a repainting panel and catastrophic here — "not known yet" would read as "no PR" and open a duplicate.
- Auto-handoff opens a **draft** PR (no review request lands in anyone's inbox); an armed merge opens non-draft, because GitHub refuses to merge or auto-merge a draft.
- Config *arms* the merge; the agent *authorizes* it (ready-for-merge + no open session TODO); a human Merge click outranks both. A withheld merge is not a failed handoff — push and PR still go.

## Facts

- Two git range spellings, opposite meanings, both needed: two-dot for the branch's own commit list (three-dot is the symmetric difference and also lists base-only commits — which once made a merged session offer a PR GitHub refuses), three-dot for the diff since the branch point.
- The stored base is a git ref (`origin/main`); `gh pr create --base` wants a remote branch name — converted at the `gh` boundary, not in the field.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
