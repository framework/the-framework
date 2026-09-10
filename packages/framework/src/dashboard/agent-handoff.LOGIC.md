Decides what becomes of an agent's [1] work once the agent has ended, its handoff [2]: reads what the agent left on its branch (commits, changed files, whether the branch is pushed or merged, which pull request is the agent's, and what it left uncommitted in its checkout [3]), runs the automatic handoff the agent was armed for — push the branch, open a pull request, merge it — with every reason a step is skipped or a merge withheld, and backs the "Open PR" and "Merge" buttons on a finished agent's page. Nothing here commits on the agent's behalf, and every read is forgiving: a project that is not a git repository, has no remote or has no `gh` yields a handoff with less in it, never an error.

## Context

**User story**:
- The user starts an agent [1] and walks away. When the agent ends, its branch is on the remote and a draft pull request is waiting, unless the user chose a lower handoff [2] level when starting it or unticked the push or the pull request in the agent's action bar. With the handoff level at `merge`, the pull request opens ready for review and lands once its checks pass, provided the agent declared its work ready for merge [4].
- On a finished agent's page the user sees what the agent produced — its commits, the files it changed, the files it left uncommitted — and pushes the branch, opens the pull request ("Open PR") or merges it ("Merge") with one press. The user is never handed an empty pull request, a second pull request for the same branch, or a pull request made only of The Framework's own bookkeeping.

**Business logic story**: the agent's own process runs the automatic handoff when the agent ends, after the agent's quality step (the built-in on-before-mergeable prompt, so what that step committed is published too) and before the event stream [5] is archived (so the outcome reaches the dashboard's history) — the sequencing lives in `../cli.ts`. The dashboard's buttons run the manual actions on a finished agent (`../dashboard-rpc/control.ts`). The CI watch [6] resolves and merges an agent's pull request with the rules here (`../ci-watch.ts`); cloud work adoption [7] opens the pull request for a branch that exists only on the remote (`../cloud-work.ts`); the intervention [8] feed reads a branch's state to list unpushed work (`interventions.ts`). Every pull request read, creation and merge goes through GitHub's `gh` command by the rules in `gh.ts`.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it). "Handoff level" is a rung of that ladder.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] ready for merge: the signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready and authorizes the handoff.
[5] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[6] CI watch: the sweep that merges the pull requests The Framework opened once their checks pass, and starts a fix agent when a check goes red.
[7] cloud anchor: an empty commit a web agent pushes before its task leaves this machine, unique to the agent: the branch the cloud session later pushes descends from it, which is how the daemon recognises that branch as the agent's (cloud work adoption).
[8] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds.
[9] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[10] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.
[11] archive: the transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.
[12] run: only the `logs` skill's record of one agent on the `agent-data` branch: a card (what was asked, the ticket, the branch, the pull request, how it ended, what it cost) and a diary (what the agent said).
[13] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[14] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[15] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.
[16] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[17] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[18] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[19] turn signals: what The Framework reads off a turn's final message: the ready-for-merge signal, the pull request title and body, markdown views, reported errors, and the gate it stops at.

## Business logic — TL;DR

- **The branch an agent's work is on** - the branch recorded on the agent, because the agent renames its branch itself; the birth branch `agent-<agent id>` only for an agent that recorded none.
- **What a finished agent left behind** - read by branch name from the project's own repository, so it reads the same whether or not the checkout still exists: the base, the branch's own commits, the change since the branch point, whether the branch is pushed and merged, its pull request, and a gone branch as a fact rather than an error.
- **Nothing to hand off** - a branch with no commit the base lacks, or whose changed files all lie under `.the-framework/`, is empty, and every step that would publish it refuses.
- **Uncommitted work is named, never committed** - what the agent left uncommitted in its checkout is listed by path, absent when nobody asked, and nothing commits it on the agent's behalf.
- **Which pull request is the agent's** - out of the branch's whole pull request history: an open one always, a closed one only when created after the agent started; the first for identity, the latest for handoff decisions.
- **The pull request the agent recorded** - the number the agent wrote down is the fact; its state is read live, and when nothing live is known the record stands on its own.
- **What an agent is armed for** - the push and the pull request start armed; the merge is armed only by the agent's configuration, never by a checkbox.
- **Configuration arms the merge, the agent authorizes it** - an armed merge is withheld unless the agent declared ready for merge and its own TODO file has no open entries; withheld means a draft pull request, not a failed handoff.
- **The automatic handoff when an agent ends** - reads the branch with a pull request lookup that waits for a real answer, then skips for a named reason (not armed, branch gone, no commits, no remote, already open, already landed, already pushed) or pushes and opens the pull request, as a draft unless the merge is armed.
- **The merge half of the automatic handoff** - runs only after the pull request half succeeded and never lands a pull request before its checks: GitHub's auto-merge, else a direct merge only on green, else the CI watch; a merge that fails never fails the handoff.
- **Opening a pull request for a branch** - push first, the base named as GitHub wants it, draft or ready for review, the URL and number read off what `gh` prints, and the cached "no pull request" forgotten.
- **The "Open PR" button** - the agent's existing pull request first, even for a gone branch, unless the agent moved past it; a gone branch and an empty branch are refused with a reason; otherwise a pull request ready for review.
- **A pull request for a branch only the remote has** - a cloud session's own branch gets a draft pull request with nothing pushed and `gh`'s default base.
- **The "Merge" button on a finished agent** - refused when the agent has no pull request or it is no longer open; otherwise merged, a draft marked ready on the way, directly where GitHub cannot arm auto-merge.
- **The pull request's title** - the agent's own title, else its session name, else "Session <agent id>", with the ticket's issue reference as "(fix #42)"; never the prompt.
- **The pull request's body** - the agent's own description, else what was asked for, then which agent did it.
- **What a handoff reports** - a button answers with success (and the pull request's URL and number) or one error line; the automatic handoff answers skipped with its reason, done, or failed at the push or the pull request step, and the number rides along so it gets recorded on the agent.

## Business logic

### The branch an agent's work is on

#### Context

**Problem**: the agent [1] renames its own branch the moment it names its work, so any branch name other than the one recorded on the agent is a guess that goes stale at that rename.

#### Business logic

The branch is the one recorded on the agent's [1] record while it ran. An agent whose record carries no branch falls back to its birth branch, `agent-<agent id [9]>`, the branch its checkout [3] was created on. That is the only fallback.

### What a finished agent left behind

#### Context

**User story**: a finished agent's [1] page shows what the agent produced and offers the next step, whether or not the agent's checkout [3] still exists.

**Problem**: a finished agent's checkout is usually gone, removed once its work is on the remote. A read addressed by checkout would fall back to the project's own working copy and report the project's branch as if it were the agent's. So the read is addressed by branch name and made from the project's own repository, and every answer degrades rather than fails.

#### Business logic

- A project directory that is not a git repository, or where git cannot run, yields no handoff [2] at all: nothing about it is answerable.
- The base the branch is measured against is the branch the remote's default points at (`origin/<default branch>`), else the first of `main` and `master` that exists locally, else none.
- The commits are the branch's own commits since the base, each with its full and seven-character id and its subject. Commits that are only on the base never count: counting them would make a branch whose work is already merged report commits it did not make, and offer a pull request that GitHub refuses with "No commits between main and <branch>".
- The files are the change since the branch point (not a comparison against a base that moved on), per file with lines inserted, lines deleted and whether the file is binary, read with the shared parser in `file-diff.ts`; the totals sum the files.
- The branch is pushed when the repository has a remote and the remote's copy of the branch is at the very same commit. It is merged when git reports it merged into the base.
- Without a base, no commits and no files can be read: the branch reads as empty and not merged.
- A branch that no longer exists locally still yields a handoff, marked as gone, with no commits and no files. Its pull request is still looked up: a hands-off [10] agent pushes its branch and opens its pull request from the cloud, and a merged branch gets deleted, so the pull request is the one thing left worth showing.
- The pull request is looked up through the dashboard's read cache and allowed to arrive late: while the lookup is still warming the handoff says "not known yet" rather than "no pull request", so the git answers never wait on `gh` and the caller can ask again.

### Nothing to hand off

#### Context

**Problem**: an agent [1] that changed nothing is a real outcome, and must be said as such rather than shown as an empty branch with buttons that would push nothing. And every agent's branch carries The Framework's own paper trail under `.the-framework/` — the event stream [5] and the archive [11] — committed for provenance, never as publishable work; publishing that alone would open pull requests of pure bookkeeping.

#### Business logic

A branch is empty when it has no commit the base does not already have, or when every file it changed lies under `.the-framework/`. The files decide, not the commits: a branch whose commits touch only bookkeeping has commits and still nothing to hand off. Uncommitted work never makes a branch non-empty. An empty branch is refused by every step that would publish it, by the rules of the automatic handoff and the "Open PR" button below.

### Uncommitted work is named, never committed

#### Context

**Problem**: the agent [1] is told to commit its work, but an agent that ends without doing so holds its whole output in an uncommitted tree in its checkout [3]. What gets published is what the agent committed; The Framework commits nothing on its behalf, so that work stays in the checkout and has to be named on the agent's page, or the page offers an "Open PR" that GitHub can only refuse for a branch with no diff.

#### Business logic

When the caller names the agent's [1] checkout [3], every file changed there and not committed is listed by path, read with the shared parser in `file-status.ts`. Those files are not on the branch: they are not among the commits and they do not make an empty branch non-empty. The list is absent, rather than empty, when no checkout was named or git could not answer: "nobody asked" and "asked, and the tree is clean" are different answers, and only the second may be shown as a clean tree. The paths are listed, not counted, so the page can name what is waiting.

### Which pull request is the agent's

#### Context

**Problem**: a branch name gets reused. An agent [1] whose prompt pins its branch name inherits every pull request its predecessors opened on that name, and GitHub's newest pull request for a branch name, in any state, may be a predecessor's merged one showing as a fresh agent's own.

#### Business logic

The branch's whole pull request history is read — through the dashboard's read cache, or through a lookup the caller supplies — and one entry is picked by the rule in `gh.ts`: an open pull request always counts, because GitHub allows one open pull request per branch and that is where pushed commits land; a merged or closed one counts only when it was created after the agent [1] started; without a start time, only an open one is trusted. When several qualify, "first" answers identity (which pull request did this agent open, so a later agent's is never the answer) and "latest" answers a handoff [2] decision (which pull request last saw the branch, so whether the agent kept working past it reads off that pull request's head commit). The agent's start time is the one recorded on it, else the moment its agent id [9] encodes.

### The pull request the agent recorded

#### Context

**Problem**: the pull request's number is a fact about the agent [1]. Re-deriving it later from branch names and creation times mistakes a predecessor's pull request on a shared branch name for the agent's, so the agent writes the number down — on its event stream [5] when its own handoff [2] opens the pull request, or on its run [12] card when the dashboard's button does after the process is gone — and every surface reads that one integer.

#### Business logic

An agent [1] with no recorded pull request has none. For an agent with one, the pull request's current state is read live through the dashboard's read cache, because it changes without the agent doing anything: a pull request merges, a human closes it. When the live read returns the recorded number, its state, title and URL are the answer. A different number on the branch is some other pull request and never this agent's answer. When the live read has nothing to say — the lookup still warming, `gh` missing, or a branch on a repository this machine cannot see — the recorded number and URL stand on their own, with state "OPEN" while the lookup is still pending (the caller may ask again) and "UNKNOWN" otherwise, and no title.

### What an agent is armed for

#### Context

**User story**: the handoff [2] level chosen when the agent [1] was started, `local`, `push`, `pr` or `merge`, is what the end of the agent does; while the agent runs, its action bar lets the user untick the push and the pull request.

#### Business logic

The push and the pull request start armed, so the common case costs nothing: an agent [1] simply left alone puts its branch on the remote and opens a pull request for it. The merge is off unless the agent's configuration armed it (handoff [2] level `merge`); no checkbox arms it. How the level and the checkboxes translate into the three halves lives in `../handoff-level.ts`. The pull request half subsumes the push half: opening a pull request pushes the branch first.

### Configuration arms the merge, the agent authorizes it

#### Context

**Problem**: landing work on the default branch unattended [15] is the one handoff [2] step nobody reviews first, so configuration alone must not be enough to run it: the agent [1] itself has to have declared its work complete.

**User story**: an agent started with handoff level `merge` that never declares ready for merge [4] leaves a draft pull request for the user instead of merging, and its page says the merge was withheld and why.

#### Business logic

An armed merge may run only when the agent [1] emitted the ready-for-merge [4] signal and its own TODO file, `TODO_<session name [13]>.agent.md` in its checkout [3], has no open entries. The first condition that fails is the recorded reason: the agent never declared ready for merge (`not-ready-for-merge`), else its own TODO file still has open entries (`session-todo-open`). The agent queue [14] (`TODO_AGENTS.md`) never withholds a merge: it is decoupled from agents, and withholding on it would mean no merge ever runs while the project has a backlog at all. A withheld merge is not a failed handoff: the push and the pull request go ahead, and the pull request opens as a draft for a human. The user's "Merge" on a running agent bypasses this gate: the authorization the gate exists to collect has been given directly (`../cli.ts`, `../dashboard-rpc/control.ts`).

### The automatic handoff when an agent ends

#### Context

**User story**: the user starts an agent [1] and does not come back. When the agent ends, its branch is on the remote and a draft pull request is waiting for review — or the agent's page says exactly why nothing was published.

**Business logic story**: the agent's own process runs this at its end, once, and two skips are decided there before anything here runs: an agent that was stopped [16] publishes nothing (publishing what it happened to reach is the opposite of what stopping meant), and an agent run by the `fake` driver [17] has nothing real to publish (`../cli.ts`).

#### Business logic

In this order:

- Neither the push nor the pull request armed: skipped, `not-armed`.
- The branch's state is read with a pull request lookup that does not go through the dashboard's read cache and waits for a real answer: a cached "not known yet" would read as "no pull request" and open a second one. The lookup is filtered by the agent's [1] start time, so a merged pull request from an earlier agent on the same branch name does not stop this agent from opening its own, and it picks the latest pull request that saw the branch.
- The branch is gone, or the project cannot be read: skipped, `branch-gone`.
- Nothing to hand off: skipped, `no-commits`.
- The repository has no remote: skipped, `no-remote`.
- The branch has an open pull request: skipped, `already-open`. The open pull request covers both halves — the branch is published and the human has a place to answer — and opening a second one is the one mistake the handoff [2] must never make. An armed merge still applies to that open pull request, since this is a rerun or a restart finding the pull request its predecessor opened and the merge is the half that has not happened yet: the merge half below runs on it, and its outcome rides along with the skip.
- The branch's pull request is merged or closed and its head commit is still the branch tip: skipped, `already-landed`, since everything the agent did already reached the human. A tip past that head means the agent kept committing after the pull request closed: the handoff goes on and opens a fresh pull request for the new work, or that work reaches nobody.
- The pull request armed: the branch is pushed and a pull request opened by the rule below, with the title and body rules below and the detected base, as a draft unless the merge is armed — GitHub refuses to merge or auto-merge a draft, and an armed merge means the review happened on the agent queue before the agent ran. A failure ends the handoff as failed at the `pr` step with the error. Otherwise the merge half runs when armed, and the outcome is done, with the branch pushed and the pull request's URL and number.
- Only the push armed: a branch already on the remote at this commit is skipped, `already-pushed`; otherwise the branch is pushed to `origin`, and a failure ends the handoff as failed at the `push` step with git's own reason line.

### The merge half of the automatic handoff

#### Context

**Problem**: a merge that could not happen must not turn a successful handoff [2] into a failed one, because the pull request exists either way and a human can still merge it by hand. And merging a pull request directly the second it opens lands it before its first check has run: in a repository without GitHub's auto-merge, every armed pull request would land unverified.

#### Business logic

The pull request's number comes off the URL `gh` prints when it creates the pull request (`…/pull/<number>`); when `gh` printed none, the pull request lookup supplies it. No number at all is a reported merge failure, "could not resolve the PR number to merge", and the handoff [2] is still done. With a number, the merge follows the merge rule in `gh.ts` in its watch mode: GitHub's own auto-merge is armed first, so the pull request lands when its checks pass (`auto-armed`); where GitHub refuses to arm it, the pull request is merged directly only when its checks have already passed (`merged`), and otherwise handed to the daemon's CI watch [6], which merges it once its checks go green (`watched`); a draft found on the already-open path is marked ready and tried once more; any other refusal is reported as `failed` with GitHub's reason. Every merge squashes: an agent's [1] branch is working history, not a story worth preserving. The merge outcome is reported beside the handoff's own.

### Opening a pull request for a branch

#### Context

**Problem**: GitHub refuses to open a pull request for a branch the remote has never seen, so the push must be part of the action rather than something the user has to remember first. GitHub also wants the base as a branch on the remote ("Base ref must be a branch"), while the base the read detected is git's remote-tracking name.

#### Business logic

The branch is pushed to `origin` first, setting its upstream. A failed push ends the action with git's own reason — the `fatal:`, `error:` or `remote:` line, never a stack trace. The pull request is then created for that head branch with the given title and body, against the given base with any `origin/` prefix removed, and as a draft when asked. A pull request a human asked for by name — the "Open PR" button — opens ready for review, because asking for it is asking for review. The automatic handoff [2] opens a draft: a pull request opened by itself at the end of every agent [1] must not put a review request in anyone's inbox, which is safe only because the intervention [8] feed keeps listing a draft on an agent's branch (`interventions.ts`). The new pull request's URL is the last line `gh` prints and its number is that URL's last path segment; an output with no URL still counts as success, since the pull request is open. The branch's cached "no pull request" answers — the single view and the history — are forgotten, so the page stops offering to open one. A `gh` failure is returned as its own message.

### The "Open PR" button

#### Context

**User story**: on a finished agent's [1] page the user presses "Open PR" and gets the pull request: the existing one when there is one, a new one otherwise, or a clear reason why there is none.

#### Business logic

The branch's state is read with the agent's [1] start time, picking the latest pull request that saw the branch. The agent's pull request is the answer first, even when the branch is gone locally — a hands-off [10] agent's branch only ever existed on the remote, and its pull request is what the button exists to give — unless the agent demonstrably moved past it. An agent has moved past its pull request when the pull request is merged or closed and its head commit is known and differs from the branch tip; never for an open pull request (pushed commits still land on it), never when the lookup carried no head commit (a duplicate pull request is not risked on a guess), and never for a gone branch (no tip to compare, so the pull request stays the best answer). Then a branch that no longer exists is refused with "branch <branch> no longer exists", and an empty branch with "this session produced no commits to open a PR for". Otherwise a pull request is opened by the rule above, ready for review unless the caller asks for a draft, with the title and body rules below and the detected base. The dashboard records the number and URL it gets back on the agent's run [12] card (`../dashboard-rpc/control.ts`).

### A pull request for a branch only the remote has

#### Context

**Business logic story**: a cloud session [18] pushes its own `claude/*` branch from a machine this daemon never sees. Cloud work adoption matches that branch to its agent [1] by its descent from the agent's cloud anchor [7], and when the agent was armed for a pull request and the session opened none, opens it with this rule (`../cloud-work.ts`).

#### Business logic

Nothing is pushed: creating the pull request for the remote branch is the whole action, against `gh`'s default base (the repository's default branch), with the title and body rules below, and always as a draft — a pull request The Framework opens by itself must not request anyone's review, and the intervention [8] feed keeps listing it. The URL and number are read the same way as above, and the branch's cached answers are forgotten.

### The "Merge" button on a finished agent

#### Context

**User story**: an agent [1] that never declared ready for merge [4] left a draft pull request behind; the user reads it and presses "Merge": it is good, land it. ("Merge" on an agent still running is steering, handled in `../dashboard-rpc/control.ts`.)

#### Business logic

The agent's [1] recorded pull request is resolved by the rule above. No pull request: refused with "this session has no pull request to merge". A pull request that is not open: refused with "this session's PR is already merged" (or "closed"), because that is an answer, not an action. Otherwise the pull request is merged by the merge rule in `gh.ts` in its direct mode: GitHub's auto-merge first, a draft marked ready on the way (this is exactly the withheld-merge case), and where GitHub cannot arm auto-merge the pull request is merged directly, because a human just said to land it. A refusal is returned as the error. On success the branch's cached pull request answers are forgotten, so the page stops offering a merge for a pull request that landed, and the pull request's URL and number are returned.

### The pull request's title

#### Context

**Problem**: a squash merge makes the pull request's title the commit subject on the default branch, permanently. A prompt cut to a title's length would leave the default branch carrying instructions truncated mid-sentence, which describe neither what changed nor a whole thought. And a pull request that lands a ticket's work unattended [15] must close the GitHub issue the ticket tracks, or the ticket stays open.

#### Business logic

Three rungs, each a name for the work the agent [1] did: the title the agent gave its work in its turn signals [19] (the first line of its `open-pr` block), else the agent's session name [13] (its branch minus the `agent-` prefix, when the agent named its work), else "Session <agent id [9]>", which says little but says it honestly. The prompt the agent was given is never the title. When the agent implements a ticket that tracks a GitHub issue, the reference rides along as "(fix #42)", so the squash-merge commit, which inherits the title, closes the issue. The caller leaves that reference off an agent started to plan a ticket, whose pull request lands the plan and not the work, and defuses any closing phrase in such an agent's own title and description for the same reason (`../cli.ts`).

### The pull request's body

#### Context

See `## Context`.

#### Business logic

The agent's [1] own description of the work from its turn signals [19] (its `open-pr` block) when it wrote one, because it describes what the change turned out to be; else what the agent was asked for at the start, which is all The Framework knows on its own. Then, after a blank line, "Opened from The Framework session `<session name [13]>`." — the agent id [9] standing in when the agent never named its work. Nothing else.

### What a handoff reports

#### Context

**Problem**: an agent [1] the dashboard started has no terminal anyone reads, so the outcome of its handoff [2] travels on its event stream [5] or it does not travel at all, and skips are reported for the same reason: silence would read as "it ran and did nothing".

#### Business logic

A button action answers with success — and, when a pull request is involved, its URL and number — or with failure and one error line. The automatic handoff [2] answers with one of three outcomes: skipped, with its reason and, when an armed merge ran on an already-open pull request, the merge outcome; done, with whether the branch was pushed, the pull request's URL and number, and the merge outcome when the merge was armed; or failed, at the `push` or the `pr` step, with the error. The agent's process appends the outcome to the event stream [5] and, on a done handoff with a number, records the pull request on the agent [1]; the dashboard's "Open PR" button records it on the agent's run [12] card (`../cli.ts`, `../dashboard-rpc/control.ts`). The number rides along with the URL because the number is the fact worth recording: every later surface reads it off the agent instead of re-deriving it from branch names and timestamps.
