Every fact the daemon reads from GitHub, and the one thing it writes there, goes through the `gh` CLI in this one place: the pull request linked to an agent's [1] branch, every pull request a branch name has ever had, a pull request's check state, whether the repository allows GitHub auto-merge, a checkout's [2] open pull requests, the GitHub token an agent on a GitHub Actions runner authenticates with, and merging a pull request. Reads are capped at 8 seconds and, with two deliberate exceptions, answer "nothing" instead of failing when `gh` is not installed, logged out or cannot reach GitHub; the reads the dashboard polls are served through the read-through cache described in `cache.ts`.

## Context

**User story**: the user opens an agent [1] in the dashboard and sees its pull request's number and state in the git status bar and in the handoff [3] summary of the agent view [4]; the "needs you" feed lists pull requests waiting for review; the launcher [5] warns when the repository does not allow auto-merge; and an agent ending at handoff level `merge` lands its pull request once its checks pass. All of it works with nothing more than a `gh` that is logged in, and none of it breaks a page when `gh` is missing.

**Problem**: two unknowns look alike and must not be confused. "There is no pull request" and "GitHub could not be asked" are the same to a panel that only renders, but different to a caller about to open a pull request (it would open a second one) and to the feed that remembers what it has already announced (it would announce every open pull request again). Each read therefore picks, deliberately, which of the two it answers on failure.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[3] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[4] agent view: one agent's page.
[5] launcher: the Start form on project home, a project's own page.
[6] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[7] CI watch: the sweep that merges the pull requests The Framework opened once their checks pass, and starts a fix agent when a check goes red.
[8] routine: a preset the daemon fires on its own on a schedule — update tickets, triage quick, triage consensual, plan tickets, maintenance — each switchable off and runnable on demand.
[9] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.
[10] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds.

## Business logic — TL;DR

- **Reads forgive, writes report** - a read is capped at 8 seconds and answers "nothing" when `gh` cannot answer, except the two reads whose callers must tell "none" from "could not tell"; a write action gets 60 seconds and fails with `gh`'s own error text.
- **The GitHub token for an Actions agent** - `GH_TOKEN`, else `GITHUB_TOKEN`, else the `gh` CLI's own credential; none of them means the agent does not start, with no word on why `gh` declined.
- **The pull request linked to a branch** - the pull request `gh` links to a named branch or to the checkout's current branch, with its number, URL, state, title, creation time and head commit, cached per checkout and branch and forgotten after an action that changes it.
- **Every pull request a branch name has ever had** - up to 20 pull requests in any state, newest first, an empty list when `gh` cannot answer, except for the caller about to open a pull request, for whom a failed listing is a failure.
- **Which pull request is the agent's own** - an open pull request always; a closed or merged one only when created after the agent started, the oldest such, or the newest for the caller asking what last landed.
- **Merging a pull request** - arm GitHub auto-merge with a squash, ready a draft and retry, fall back to a direct merge or to the CI watch only on the refusals that mean "auto-merge is not available here", report every other refusal, never throw.
- **A pull request's check state** - "passing", "failing", "pending" or "none", over check runs and classic statuses alike, with the failed checks named; unreadable is "none", never green.
- **Whether the repository allows auto-merge** - the repository's setting, cached for 5 minutes, with "could not say" kept apart from "off" so the launcher never cries wolf.
- **A checkout's open pull requests** - up to 50 open pull requests with their draft flag and head branch; a `gh` that cannot answer fails the read instead of reading as "no pull requests".

## Business logic

### Reads forgive, writes report

#### Context

**Problem**: every read here feeds a panel that renders whatever it got, so "`gh` is not installed" must cost a page load nothing; a write action is something the user or a handoff [3] is waiting on, and its failure must be explained in GitHub's own words.

#### Business logic

A read runs `gh` with an 8-second cap. When `gh` is not installed, not logged in, has no remote to talk to, cannot reach GitHub, outruns the cap, or answers with something that is not JSON, the read answers its "nothing" value: no linked pull request, an empty list, no checks, an unknown setting. Two reads are exceptions and fail loudly instead, because their callers must tell "none" from "could not tell": the pull request history read by a caller about to open a pull request, and the list of a checkout's [2] open pull requests, both described below.

A write action runs `gh` with a 60-second cap, since it talks to the network and to git while the user waits on a button they pressed. When it fails, the error is `gh`'s own message ("not logged in", "no default remote") rather than a generic failure; a `gh` that outruns its cap fails as a timeout, by the runner's rule in `cli-exec.ts`. The write runner defined here is also what the handoff's [3] own `gh` actions (pushing, opening a pull request, in `agent-handoff.ts`) run on.

### The GitHub token for an Actions agent

#### Context

**User story**: the user starts an agent [1] whose location [6] is `actions`; the runner needs a GitHub token, and a machine whose `gh` can already open pull requests should start that agent without further setup.

#### Business logic

The token is `GH_TOKEN` from the environment, else `GITHUB_TOKEN`; a set-but-empty variable counts as unset. The environment wins because CI sets these variables and they must beat whatever `gh` happens to be logged in as on the runner. With neither set, the token is the `gh` CLI's own credential (what `gh auth token` prints), the same credential every pull request The Framework opens is authenticated by; a blank answer is no token. When `gh` is missing, logged out or refuses, there is no token: the caller states that as the agent's reason for not starting. The reason deliberately does not say why `gh` declined, because the caller's message already names both ways to fix it (set the variable, or log `gh` in), and a keyring prompt's error text is not something to show someone who simply has not set `GH_TOKEN`.

### The pull request linked to a branch

#### Context

See `## Context`.

#### Business logic

For a named branch, or for whatever branch the checkout [2] is currently on when none is named, the read answers the pull request `gh` links to that branch: its number, URL, state as GitHub reports it (`OPEN`, `MERGED` or `CLOSED`), title, creation time, and the head commit it covers. The creation time tells one agent's [1] pull request from a predecessor's and lets the CI watch [7] judge how long a check-less pull request has waited for its checks to attach; the head commit tells "the pull request already landed everything" from "the agent kept working after it merged". A field `gh` did not answer with is absent rather than empty, so "unknown" is never mistaken for "has none". Only these fields are kept: whatever else `gh` may add to its answer never leaks into what callers store. When there is no pull request, or `gh` could not be asked, the answer is "no pull request".

A caller looking up a finished agent's pull request always names the branch: the agent's checkout may already be gone, so "the current branch" would silently be the project's own branch, not the agent's.

The dashboard's panels read this through the read-through cache in `cache.ts`, keyed by checkout and branch, with the cache's default trust window of 60 seconds: a pull request lookup costs about 600 ms where the git facts beside it cost ten, and the answer changes about as often as someone opens a pull request. The cached answer says whether it is still pending, which means "not known yet" rather than "there is no pull request": a caller deciding whether to offer "Open PR" holds off while the answer is pending. After an action that changes whether the branch has a pull request (opening one, merging one), the cached answer is forgotten, so the next ask reads afresh.

### Every pull request a branch name has ever had

#### Context

**Problem**: GitHub's "the pull request for this branch" answers with the newest pull request for that branch name in any state, so an agent [1] whose prompt pins its branch name (a routine's [8] branch such as `the-framework/triage-quick`) would inherit a predecessor's merged pull request as its own. Keeping the whole history lets the next rule decide which entry, if any, belongs to the agent asking.

#### Business logic

The read lists every pull request whose head is the branch, in every state, newest first, at most 20, with the same fields as the linked pull request. When `gh` could not be asked the list is empty, which is indistinguishable from "no pull requests" and is what every caller would do with a failure anyway. The one exception is the variant used by a caller about to open a pull request: there a listing that fails is a failure, not "no pull requests", because the difference is a second draft pull request on a branch that already has one. The list is also served through the read-through cache (`cache.ts`), keyed by checkout [2] and branch, and forgotten after an action that changes it, such as opening a pull request.

### Which pull request is the agent's own

#### Context

**Problem**: a branch name's history may hold other agents' [1] pull requests (see the previous section), and a merged two-day-old pull request must not show as a fresh agent's own.

#### Business logic

Out of a branch name's pull request history, an open pull request always counts: GitHub allows one open pull request per branch, so whatever is open on the agent's [1] branch is where its pushed commits land. A closed or merged one counts only when it was created at or after the moment the agent started, and only entries with a known creation time qualify; the oldest such entry is the one this agent's handoff [3] opened, and anything older is a previous agent's pull request wearing the same branch name. Without the agent's start time, only an open pull request is trusted.

One caller asks the opposite question: not "which pull request did this agent open" but "which pull request last saw the branch", so it can read off that pull request's head commit whether the agent kept working past it. For that caller the newest qualifying closed entry wins instead of the oldest, since the oldest would call work that a second pull request already landed unlanded.

### Merging a pull request

#### Context

**User story**: an agent [1] whose handoff [3] level is `merge` lands its pull request when the checks pass, not before them. A repository that does not allow GitHub auto-merge must not see every armed pull request merged seconds after opening, before its first check runs.

#### Business logic

A merge is always a squash merge: an agent's branch is working history, not a story worth preserving. The first attempt arms GitHub auto-merge, so the pull request lands when its checks pass; success is the outcome "auto-armed". When GitHub refuses because the pull request is a draft (one a previous agent's handoff left behind, since an armed handoff opens its own pull request ready), the pull request is marked ready and arming is tried once more: an armed merge is the statement that its review already happened.

Only a refusal that means "auto-merge is not available here" leads to the fallback: GitHub's "auto merge is not allowed for this repository" (the repository setting is off), "clean status" (nothing blocks the pull request, and auto-merge is only for pull requests that cannot land yet), the `enablePullRequestAutoMerge` marker both of those carry, or a "protected branch" refusal, all matched loosely and case-insensitively so that a rephrasing on GitHub's side degrades to a reported failure, never a wrong merge. Any other refusal (a merge conflict, a permissions problem, a network failure) is reported as the outcome "failed" with GitHub's own words, and never retried as a direct merge, which would either fail again or land a pull request GitHub just said not to.

The fallback depends on the policy the caller chose. Under the default policy, "merge now", right where a human just said "land it", the pull request is merged directly; success is "merged", and a direct merge that also fails reports that second refusal as "failed". Under the "watch" policy, the policy of the unattended [9] path, the pull request's check state (next section) decides: the pull request is merged directly only when every check has passed, and otherwise the outcome is "watched", meaning the daemon's CI watch [7] merges it on green. "No checks reported" does not merge now, because a check suite takes a few seconds to attach after a push and a just-opened pull request reads as check-less exactly then; the CI watch merges a genuinely check-less pull request after its own grace period. The refusal text never makes this decision, only the checks read does: "clean status" sounds like "nothing blocks it", but GitHub also says it for a pull request whose non-required checks are still running.

Merging never throws: the caller reports the merge outcome alongside the handoff's, and a merge that could not happen must not turn a successful handoff into a failed one.

### A pull request's check state

#### Context

**Business logic story**: the fallback merge above and the CI watch [7] both ask one question of a pull request: may it land, is it red, or is it still running?

#### Business logic

A pull request's checks are read as one combined state covering both GitHub Actions check runs and classic commit statuses. "passing": every check has concluded and none failed; skipped and neutral conclusions count as passing, as GitHub's own merge box treats them. "failing": at least one concluded check did not succeed, whatever the rest are doing; a cancelled or timed-out check counts as failed too, since it is not evidence the work is good, and red now is not unsaid by more green later. "pending": something is still running and nothing has failed yet. "none": no checks reported, which means either the repository has no CI or the suite has not attached yet, which is why callers treat it with a grace period rather than as green. "none" is also the answer when `gh` could not say, because acting on an unreadable status must never merge anything.

A check run is concluded once its status is completed. A classic status has no separate progress: its state is both progress and verdict, and it is concluded unless that state is pending. Alongside the state, the read names the failed checks (a check run by its name, a classic status by its context, or "unnamed check") for the fix agent's prompt, and reports the pull request's head commit and head branch, so a fix attempt can be recorded against the state it saw and the fix lands on the right branch.

### Whether the repository allows auto-merge

#### Context

**User story**: an armed merge on a repository without GitHub auto-merge is handed to the daemon's CI watch [7], which merges on green only while the daemon runs; so the launcher [5] tells the user that the merge will happen from this machine and names the repository's "Allow auto-merge" setting on GitHub.

#### Business logic

The setting is read from the repository's own record in the GitHub API. The answer is known, as "allowed" or "not allowed", only when GitHub reports the setting as a boolean. When `gh` is missing or not logged in, the repository is not on GitHub, the answer is not JSON, or GitHub omits the setting (it does for viewers without push access), the answer is "could not say", which the launcher renders as nothing at all, never as a real "off": no crying wolf. Because the launcher polls it and the setting barely changes, the read is served through the read-through cache (`cache.ts`) with a 5-minute trust window.

### A checkout's open pull requests

#### Context

**Business logic story**: the interventions [10] feed (`interventions.ts`) reads a project's open pull requests to announce the ones waiting for review, and remembers what it has already announced.

#### Business logic

The read lists a checkout's [2] open pull requests, at most 50, each with its number, title, URL, whether it is a draft, its head branch (so an agent's [1] own pull request can be recognized as The Framework's), and its creation time. Unlike the other reads, this one fails when `gh` could not answer (no remote, not logged in, GitHub unreachable) instead of answering an empty list: "no pull requests are open" and "I could not look" are different answers, and a caller that took the second for the first would announce every already-open pull request as new on its next successful read. The caller decides what a failure costs; it cannot decide about what it never hears of.
