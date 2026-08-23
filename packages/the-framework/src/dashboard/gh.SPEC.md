Everything The Framework asks GitHub, in one place: which pull request belongs to a branch, where a pull request's CI stands, whether the repo allows auto-merge, and the merge itself — plus the GitHub credential an agent needs to run on the `actions` run target.

## Glossary

- **auto-merge** - GitHub's own "merge when checks pass" setting on a pull request: the merge is armed now and GitHub performs it once the pull request's required checks are green.

## Business logic — TL;DR

- **Reads are cheap and never fail a page** - a lookup that cannot be answered (GitHub CLI missing, logged out, no remote) reads as "nothing found" and is capped short, so a dashboard panel always renders; the two exceptions below are deliberate.
- **Two reads report failure instead of "nothing"** - listing a checkout's open pull requests, and listing a branch's pull requests just before opening one, both raise the failure: mistaking "could not look" for "there is none" would re-announce every open pull request as new, or open a second pull request on a branch that already has one.
- **The GitHub credential for the `actions` run target** - `GH_TOKEN` or `GITHUB_TOKEN` win, otherwise the GitHub CLI's own login is used; when there is none, the agent is told it cannot start rather than failing later.
- **A branch's whole pull request history, not just its newest** - so an agent is never credited with a predecessor's pull request on a branch name it reuses.
- **Which pull request belongs to this agent** - an open pull request on the agent's branch always counts; a closed one counts only if it was opened after the agent started.
- **Merge armed first, land second** - a merge request arms GitHub auto-merge so the work lands after its checks; where the repo refuses, the merge either happens directly or is handed to the daemon's CI watch, and never turns a successful handoff into a failed one.
- **One verdict for a pull request's checks** - GitHub Actions check runs and classic commit statuses are folded into passing / failing / pending / none, with "could not read" deliberately answering none.

## Business logic

### The GitHub credential for the `actions` run target

#### User story

The user starts an agent on the `actions` run target. That agent runs on a GitHub Actions runner and needs a GitHub token to do anything.

#### Business logic

The token is taken from `GH_TOKEN` or `GITHUB_TOKEN` when either is set, and otherwise from the GitHub CLI's own stored login. When neither yields a token, the answer is "no token", which the caller turns into the agent's stated reason for not starting.

#### Rationale

The environment variables win because CI sets them and must beat whatever account the GitHub CLI happens to be logged in as on the runner. Falling back to the CLI's login means any machine that can already open a pull request can also start an `actions` agent, without the user configuring a second credential. Why the CLI declined is never reported: the caller's message already names both ways to fix it, and a credential-keyring prompt is not something to put in front of someone who simply has not set a token.

### The pull request for a branch

#### User story

The dashboard shows, for an agent's checkout, whether its branch already has a pull request — which decides whether the user is offered "Open PR" or a link to the existing one.

#### Business logic

A pull request is looked up either for a named branch or, when no branch is named, for whatever branch the checkout is on. The answer carries the pull request's number, link, state (open / merged / closed), title, creation time and head commit; nothing else GitHub returns is kept.

The answer is cached per checkout and branch and refreshed behind whoever asks, and callers are told when the answer is not known yet — which is a different answer from "there is no pull request". Any action that changes whether a branch has a pull request forgets the cached answer.

#### Rationale

A pull request lookup costs roughly a hundred times what the git reads beside it cost, while the answer only changes when somebody opens or closes a pull request. Naming the branch explicitly matters for a finished agent: its worktree may already be gone, so "the branch the checkout is on" would silently be the project's default branch rather than the agent's.

### Which pull request belongs to this agent

#### User story

An agent whose task pins its branch name — a routine that always works on the same branch, for instance — must not be credited with the pull request a previous agent opened on that same branch name, which would show a two-day-old merged pull request as this agent's own result.

#### Business logic

The whole history of pull requests for a branch name is read, in any state, newest first. Out of that history, the pull request belonging to an agent is chosen as follows: an open pull request on the branch always counts, because GitHub allows only one open pull request per branch and that is where the agent's pushed commits land. A closed pull request counts only when it was created after the agent started; anything older belongs to a previous agent. Without knowing when the agent started, only an open pull request is trusted.

Where several pull requests qualify, the caller asks one of two questions: which pull request *this agent opened* (the oldest qualifying one), or which pull request *last saw the branch* (the newest qualifying one) — the latter being how the handoff decides whether the agent kept working after its pull request already landed.

### Merging a pull request

#### User story

An agent finishes with a handoff level of `merge`: its work should land, but only after CI has confirmed it.

#### Business logic

The merge is first attempted as an armed auto-merge, squashed, so GitHub lands it once its checks pass. A pull request left as a draft by an earlier attempt is marked ready and the arming retried once, because an armed merge is itself the statement that the review already happened.

When GitHub refuses to arm — the repository has auto-merge disabled, or the pull request already has nothing blocking it — the caller's chosen fallback decides:
- merge directly, which is right where a human just pressed the button; or
- merge directly only when the pull request's checks have already passed, and otherwise report that the pull request is now being watched, leaving the daemon's CI watch to merge it on green.

Any refusal that is not a recognised "auto-merge is unavailable here" is reported as a failed merge, never merged directly. A merge never raises a failure to its caller: the outcome is reported alongside the handoff's, so a merge that could not happen does not turn a successful handoff into a failed one.

Every merge is a squash: an agent's branch is working history, not a story worth preserving.

#### Rationale

The deferred fallback exists because merging directly on a repository without GitHub auto-merge merged every armed pull request seconds after it was opened, before its first check had even started. The decision uses the checks read rather than GitHub's refusal wording, because GitHub reports a pull request as having nothing blocking it while its non-required checks are still running — exactly the window that hazard lives in. A pull request reporting no checks at all is not merged either, because a check suite takes a few seconds to attach after a push and a just-opened pull request reads as check-less precisely then.

### Where a pull request's CI stands

#### User story

The daemon's CI watch decides whether to merge a pull request, and whether to start a fix agent — it needs one verdict on the pull request's checks and, when red, which checks failed.

#### Business logic

GitHub Actions check runs and classic commit statuses are read together and folded into one verdict:
- **passing** - every check concluded and none failed, so the pull request may land;
- **failing** - at least one concluded check failed, whatever the others are doing;
- **pending** - something is still running and nothing has failed;
- **none** - no checks were reported at all.

Skipped and neutral results count as passing, matching GitHub's own merge box; every other non-successful conclusion, cancellation and timeout included, counts as failed. The read also reports the names of the failed checks (for the fix agent's prompt), the pull request's head commit, and its branch.

A read that could not be answered reports **none**, never a verdict — acting on an unreadable status must never merge anything.

#### Rationale

A cancelled or timed-out check is not evidence the work is good, and the merge this feeds exists to stop unverified work landing.

### Whether the repository allows auto-merge

#### User story

Before starting an agent that will merge its own work, the dashboard warns the user when the repository has GitHub auto-merge switched off — because then the merge depends on the daemon's CI watch, which only runs while the daemon does.

#### Business logic

The repository setting is read from GitHub and cached for several minutes, since the launcher polls it and the setting barely changes. When it cannot be determined — GitHub CLI missing or logged out, not a GitHub repository, or the reader has no push access and GitHub therefore omits the setting — the answer is "could not say", which renders nothing rather than a warning.

#### Rationale

Not crying wolf is the same stance the repository-trust read takes: a warning shown on a "could not say" would fire on every machine that simply has not logged the GitHub CLI in.

### A checkout's open pull requests

#### User story

The interventions list pools open pull requests across projects as things needing the user, and announces newly opened ones.

#### Business logic

A checkout's open pull requests are listed with their number, title, link, draft flag, source branch and creation time. This read raises a failure when GitHub could not answer — no remote, not authenticated, GitHub unreachable — instead of reporting an empty list.

The draft flag and the source branch are both reported, because a draft is generally not asking for review and is left off the list, except for a draft The Framework itself opened, which the source branch is what identifies.

#### Rationale

Its caller keeps a record of which pull requests it has already announced. Taking "I could not look" for "no pull requests are open" would empty that record and make the next successful read announce every already-open pull request as new. The caller decides what a failure costs; it cannot decide about something it never hears about.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
