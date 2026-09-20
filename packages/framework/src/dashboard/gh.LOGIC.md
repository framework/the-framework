Every fact the daemon reads from GitHub goes through the `gh` CLI in this one place: the pull request linked to an agent's [1] branch, every pull request a branch name has ever had, and a checkout's [2] open pull requests. Nothing is written to GitHub here: pushing a branch, opening its pull request and merging it are the project's branches provider's (`../store/branches.ts`). Reads are capped at 8 seconds and, with two deliberate exceptions, answer "nothing" instead of failing when `gh` is not installed, logged out or cannot reach GitHub; the reads the dashboard polls are served through the read-through cache described in `cache.ts`.

## Context

**User story**: the user opens an agent [1] in the dashboard and sees its pull request's number and state in the git status bar and in the handoff [3] summary of the agent view [4]; and the "needs you" feed lists pull requests waiting for review. All of it works with nothing more than a `gh` that is logged in, and none of it breaks a page when `gh` is missing.

**Problem**: two unknowns look alike and must not be confused. "There is no pull request" and "GitHub could not be asked" are the same to a panel that only renders, but different to a caller about to open a pull request (it would open a second one) and to the feed that remembers what it has already announced (it would announce every open pull request again). Each read therefore picks, deliberately, which of the two it answers on failure.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[3] handoff: what becomes of an agent's work once the agent has ended: its branch pushed, a pull request opened for it, the pull request merged. The agent does it itself; on a finished agent's page the "Open PR" and "Merge" buttons do it by hand.
[4] agent view: one agent's page.
[5] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds.

## Business logic — TL;DR

- **Reads forgive** - a read is capped at 8 seconds and answers "nothing" when `gh` cannot answer, except the two reads whose callers must tell "none" from "could not tell".
- **The pull request linked to a branch** - the pull request `gh` links to a named branch or to the checkout's current branch, with its number, URL, state, title, creation time and head commit, cached per checkout and branch and forgotten after an action that changes it.
- **Every pull request a branch name has ever had** - up to 20 pull requests in any state, newest first, an empty list when `gh` cannot answer, except for the caller about to open a pull request, for whom a failed listing is a failure.
- **Which pull request is the agent's own** - an open pull request always; a closed or merged one only when created after the agent started, the oldest such, or the newest for the caller asking what last landed.
- **A checkout's open pull requests** - up to 50 open pull requests with their draft flag and head branch; a `gh` that cannot answer fails the read instead of reading as "no pull requests".

## Business logic

### Reads forgive

#### Context

**Problem**: every read here feeds a panel that renders whatever it got, so "`gh` is not installed" must cost a page load nothing.

#### Business logic

A read runs `gh` with an 8-second cap. When `gh` is not installed, not logged in, has no remote to talk to, cannot reach GitHub, outruns the cap, or answers with something that is not JSON, the read answers its "nothing" value: no linked pull request, an empty list. Two reads are exceptions and fail loudly instead, because their callers must tell "none" from "could not tell": the pull request history read by a caller about to open a pull request, and the list of a checkout's [2] open pull requests, both described below.

### The pull request linked to a branch

#### Context

See `## Context`.

#### Business logic

For a named branch, or for whatever branch the checkout [2] is currently on when none is named, the read answers the pull request `gh` links to that branch: its number, URL, state as GitHub reports it (`OPEN`, `MERGED` or `CLOSED`), title, creation time, and the head commit it covers. The creation time tells one agent's [1] pull request from a predecessor's; the head commit tells "the pull request already landed everything" from "the agent kept working after it merged". A field `gh` did not answer with is absent rather than empty, so "unknown" is never mistaken for "has none". Only these fields are kept: whatever else `gh` may add to its answer never leaks into what callers store. When there is no pull request, or `gh` could not be asked, the answer is "no pull request".

A caller looking up a finished agent's pull request always names the branch: the agent's checkout may already be gone, so "the current branch" would silently be the project's own branch, not the agent's.

The dashboard's panels read this through the read-through cache in `cache.ts`, keyed by checkout and branch, with the cache's default trust window of 60 seconds: a pull request lookup costs about 600 ms where the git facts beside it cost ten, and the answer changes about as often as someone opens a pull request. The cached answer says whether it is still pending, which means "not known yet" rather than "there is no pull request": a caller deciding whether to offer "Open PR" holds off while the answer is pending. After an action that changes whether the branch has a pull request (opening one, merging one), the cached answer is forgotten, so the next ask reads afresh.

### Every pull request a branch name has ever had

#### Context

**Problem**: GitHub's "the pull request for this branch" answers with the newest pull request for that branch name in any state, so an agent [1] on a branch name an earlier agent already used would inherit a predecessor's merged pull request as its own. Keeping the whole history lets the next rule decide which entry, if any, belongs to the agent asking.

#### Business logic

The read lists every pull request whose head is the branch, in every state, newest first, at most 20, with the same fields as the linked pull request. When `gh` could not be asked the list is empty, which is indistinguishable from "no pull requests" and is what every caller would do with a failure anyway. The one exception is the variant used by a caller about to open a pull request: there a listing that fails is a failure, not "no pull requests", because the difference is a second draft pull request on a branch that already has one. The list is also served through the read-through cache (`cache.ts`), keyed by checkout [2] and branch, and forgotten after an action that changes it, such as opening a pull request.

### Which pull request is the agent's own

#### Context

**Problem**: a branch name's history may hold other agents' [1] pull requests (see the previous section), and a merged two-day-old pull request must not show as a fresh agent's own.

#### Business logic

Out of a branch name's pull request history, an open pull request always counts: GitHub allows one open pull request per branch, so whatever is open on the agent's [1] branch is where its pushed commits land. A closed or merged one counts only when it was created at or after the moment the agent started, and only entries with a known creation time qualify; the oldest such entry is the one this agent's handoff [3] opened, and anything older is a previous agent's pull request wearing the same branch name. Without the agent's start time, only an open pull request is trusted.

One caller asks the opposite question: not "which pull request did this agent open" but "which pull request last saw the branch", so it can read off that pull request's head commit whether the agent kept working past it. For that caller the newest qualifying closed entry wins instead of the oldest, since the oldest would call work that a second pull request already landed unlanded.

### A checkout's open pull requests

#### Context

**Business logic story**: the interventions [5] feed (`interventions.ts`) reads a project's open pull requests to announce the ones waiting for review, and remembers what it has already announced.

#### Business logic

The read lists a checkout's [2] open pull requests, at most 50, each with its number, title, URL, whether it is a draft, its head branch (so an agent's [1] own pull request can be recognized as The Framework's), and its creation time. Unlike the other reads, this one fails when `gh` could not answer (no remote, not logged in, GitHub unreachable) instead of answering an empty list: "no pull requests are open" and "I could not look" are different answers, and a caller that took the second for the first would announce every already-open pull request as new on its next successful read. The caller decides what a failure costs; it cannot decide about what it never hears of.
