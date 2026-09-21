Decides what becomes of an agent's [1] work once the agent has ended, its handoff [2]: reads what the agent left on its branch (commits, changed files, whether the branch is pushed or merged, what it left uncommitted in its checkout [3]) through the project's branches provider [14], works out which pull request is the agent's, and backs the "Push", "Open PR" and "Merge" buttons on a finished agent's page. It runs no git and no git host tool itself: pushing a branch is the branches provider's, opening a pull request and landing it are the git host provider's [19], each asked through the command its package declares; opening a pull request is the two composed, the push then the open. It publishes nothing on its own: an agent publishes its own work, and the automatic handoff the daemon's former run process ran when an agent ended is gone with that process. Nothing here commits on the agent's behalf, and every read is forgiving: a project with no branches provider, no git host, or no remote yields a handoff with less in it, never an error; without a git host, the last step is the push.

## Context

**User story**:
- The user starts an agent [1] and walks away. The agent publishes its own work: it pushes its branch and opens its pull request itself. Nothing here does it for the agent.
- On a finished agent's page the user sees what the agent produced — its commits, the files it changed, the files it left uncommitted — and opens the pull request ("Open PR") or merges it ("Merge") with one press; on a project with no git host package, pushes the branch ("Push"). The user is never handed an empty pull request or a second pull request for the same branch.

**Business logic story**: the dashboard's buttons run the manual actions on a finished agent (`../dashboard-rpc/control.ts`); cloud work adoption opens the pull request for a branch that exists only on the remote (`../cloud-work.ts`); the intervention [8] feed reads branch states through the same provider to list unpushed work (`interventions.ts`). Every pull request read goes through the git host provider [19] by the rules in `pull-requests.ts`; every push goes through the branches provider [14] by the contract in `../store/branches.ts`, and every pull request opened or landed through the git host provider [19] by the contract in `../store/git-host.ts`.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] handoff: what becomes of an agent's work once the agent has ended: its branch pushed, a pull request opened for it, the pull request merged. The agent does it itself; on a finished agent's page the "Open PR" and "Merge" buttons do it by hand.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[7] cloud anchor: an empty commit unique to a `web` agent, pushed before its task left this machine and recorded on the agent: the branch the cloud session later pushes descends from it, which is how the daemon recognises that branch as the agent's (cloud work adoption).
[8] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds.
[9] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[10] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.
[12] run: only the `logs` skill's record of one agent on the `agent-data` branch: a card (what was asked, the branch, the pull request, how it ended, what it cost) and a diary (what the agent said).
[14] branches provider: the package of the project that declares it provides the checkouts and branches; The Framework reads a branch's state and pushes branches through the command that package declares (`../store/branches.ts`). Git only.
[19] git host provider: the package of the project that declares it provides the git host (`"framework": { "git-host": "<command>" }`); The Framework opens and lands pull requests through the command that package declares (`../store/git-host.ts`). A project with none has no git host: no pull request is opened or landed for it.
[18] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.

## Business logic — TL;DR

- **The branch an agent's work is on** - the branch recorded on the agent, because the agent renames its branch itself; an agent that recorded none has no branch to hand off.
- **What a finished agent left behind** - the branch's git facts as the branches provider answers them, so the read is the same whether or not the checkout still exists: the base, the branch's own commits, the change since the branch point, whether the branch is pushed and merged, the uncommitted work in the checkout on that branch, and a gone branch as a fact rather than an error; plus whether the project has a git host provider at all, and the agent's pull request from the dashboard's own lookup.
- **Nothing to hand off** - a branch with no commit the base lacks, or whose commits change no file, is empty, and every step that would publish it refuses.
- **Uncommitted work is named, never committed** - what the agent left uncommitted in the checkout on its branch is listed by path, as the provider names it, and nothing commits it on the agent's behalf.
- **Which pull request is the agent's** - out of the branch's whole pull request history: an open one always, a closed one only when created after the agent started; the first for identity, the latest for handoff decisions.
- **The pull request the agent recorded** - the number the agent wrote down is the fact; its state is read live, and when nothing live is known the record stands on its own.
- **Publishing a branch** - the branches provider pushes the branch, then the git host provider opens its pull request, or answers the open one it already has; a project missing either provider, or a push the branches provider refuses, ends the action before the git host is asked; the answer's URL and number come back, and the cached "no pull request" is forgotten.
- **The "Open PR" button** - the agent's existing pull request first, even for a gone branch, unless the agent moved past it; a gone branch and an empty branch are refused with a reason; otherwise the branch is published ready for review.
- **The "Push" button** - the branches provider pushes the agent's recorded branch, nothing more: the last step where the project has no git host; refused for an agent with no branch or a project with no branches provider.
- **A pull request for a branch only the remote has** - a cloud session's own branch is published as a draft, through the same two providers.
- **The "Merge" button on a finished agent** - refused when the agent has no pull request or it is no longer open, or the project has no git host; otherwise the git host provider lands the pull request.
- **The pull request's title** - the agent's own title, else the name the branches provider answers for its branch, else the branch, else "Session <agent id>"; never the prompt, and never a branch with its prefix cut off by the framework.
- **The pull request's body** - what the agent said about the work, else what was asked for, then which agent did it.
- **What a handoff reports** - a button answers with success (and the pull request's URL and number) or one error line, and the number rides along so it gets recorded on the agent.

## Business logic

### The branch an agent's work is on

#### Context

**Problem**: the agent [1] renames its own branch the moment it names its work, so any branch name other than the one recorded on the agent is a guess that goes stale at that rename.

#### Business logic

The branch is the one recorded on the agent's [1] record while it ran. An agent whose record carries no branch has no branch: nothing is guessed, and every read and action below that needs the branch answers nothing or refuses ("this session recorded no branch to open a PR from").

### What a finished agent left behind

#### Context

**User story**: a finished agent's [1] page shows what the agent produced and offers the next step, whether or not the agent's checkout [3] still exists.

**Problem**: a finished agent's checkout is usually gone, removed once its work is on the remote. A read addressed by checkout would fall back to the project's own working copy and report the project's branch as if it were the agent's. So the read is addressed by branch name, and every answer degrades rather than fails.

#### Business logic

- The branch's git facts are asked of the project's branches provider [14], for that one branch. A project with no branches provider, or a provider that does not answer for the branch, yields no handoff [2] at all: nothing about it is answerable.
- The provider answers whether the branch exists on this machine, the base it is measured against when one was found, its own commits beyond the base (newest first, each with its full id and its subject), the files it changed since the branch point (each with lines inserted, lines deleted and whether it is binary), whether the repository has a remote, whether the remote holds the branch at the very same commit, whether the base already contains it, and the uncommitted paths in the checkout [3] that is on the branch, when one is. Each commit gets a seven-character id for display, and the line totals sum the files.
- A branch that no longer exists locally still yields a handoff, marked as gone, with no commits and no files. Its pull request is still looked up: a hands-off [10] agent pushes its branch and opens its pull request from the cloud, and a merged branch gets deleted, so the pull request is the one thing left worth showing.
- The handoff says whether the project has a git host provider [19] at all (`git-host`), by asking for it: the page offers a pull request only where one can be opened, and the push alone otherwise.
- The pull request is looked up through the dashboard's read cache and allowed to arrive late: while the lookup is still warming the handoff says "not known yet" rather than "no pull request", so the git answers never wait on the git host and the caller can ask again.

### Nothing to hand off

#### Context

**Problem**: an agent [1] that changed nothing is a real outcome, and must be said as such rather than shown as an empty branch with buttons that would push nothing.

#### Business logic

A branch is empty when it has no commit the base does not already have, or when its change since the branch point touches no file: commits that net to no change leave nothing to hand off. Uncommitted work never makes a branch non-empty. An empty branch is refused by every step that would publish it, by the rule of the "Open PR" button below.

### Uncommitted work is named, never committed

#### Context

**Problem**: the agent [1] is told to commit its work, but an agent that ends without doing so holds its whole output in an uncommitted tree in its checkout [3]. What gets published is what the agent committed; The Framework commits nothing on its behalf, so that work stays in the checkout and has to be named on the agent's page, or the page offers an "Open PR" that GitHub can only refuse for a branch with no diff.

#### Business logic

When a checkout [3] is on the branch, the branches provider [14] names every file changed there and not committed, by path, and the handoff carries the list as given. Those files are not on the branch: they are not among the commits and they do not make an empty branch non-empty. The list is absent, rather than empty, when no checkout is on the branch: "no checkout" and "a checkout, and the tree is clean" are different answers, and only the second may be shown as a clean tree. The paths are listed, not counted, so the page can name what is waiting.

### Which pull request is the agent's

#### Context

**Problem**: a branch name gets reused. An agent [1] on a branch name an earlier agent used inherits every pull request its predecessors opened on that name, and the git host's newest pull request for a branch name, in any state, may be a predecessor's merged one showing as a fresh agent's own.

#### Business logic

The branch's whole pull request history is read — through the dashboard's read cache, or through a lookup the caller supplies — and one entry is picked by the rule in `pull-requests.ts`: an open pull request always counts, because a git host allows one open pull request per branch and that is where pushed commits land; a merged or closed one counts only when it was created after the agent [1] started; without a start time, only an open one is trusted. When several qualify, "first" answers identity (which pull request did this agent open, so a later agent's is never the answer) and "latest" answers a handoff [2] decision (which pull request last saw the branch, so whether the agent kept working past it reads off that pull request's head commit). The agent's start time is the one recorded on it, else the moment its agent id [9] encodes.

### The pull request the agent recorded

#### Context

**Problem**: the pull request's number is a fact about the agent [1]. Re-deriving it later from branch names and creation times mistakes a predecessor's pull request on a shared branch name for the agent's, so the number is written down on the agent's run [12] card — by the tool that runs the agent when the agent opened the pull request itself, by the dashboard when its "Open PR" button did — and every surface reads that one integer.

#### Business logic

An agent [1] with no recorded pull request has none. For an agent with one, the pull request's current state is read live through the dashboard's read cache, because it changes without the agent doing anything: a pull request merges, a human closes it. When the live read returns the recorded number, its state, title and URL are the answer. A different number on the branch is some other pull request and never this agent's answer. When the live read has nothing to say — the lookup still warming, no git host provider, or a branch on a repository this machine cannot see — the recorded number and URL stand on their own, with state "OPEN" while the lookup is still pending (the caller may ask again) and "UNKNOWN" otherwise, and no title.

### Publishing a branch

#### Context

**Problem**: a git host refuses to open a pull request for a branch the remote has never seen, so the push must be part of the action rather than something the user has to remember first. How a branch is pushed and what a checkout must look like before it may be pushed are the branches provider's [14] rules; against which base the pull request opens is the git host provider's [19]; neither is the dashboard's.

#### Business logic

Two providers, in order. A project with no branches provider refuses with "this project has no branches provider to push with"; one with no git host provider refuses with "this project has no git host package to open a pull request with"; both are checked before anything moves. The branches provider [14] is asked to push the branch: the checkout on it under the provider's clean rule, else the branch itself, and a branch only the remote has counts as pushed already. A refusal of its own (a checkout on the branch holding uncommitted work, a push that failed, a branch nowhere) ends the action with the provider's own line as the error, and the git host is never asked. Then the git host provider [19] is asked to open the branch's pull request with the given title and body, and as a draft when asked; it answers the open pull request the branch already has when there is one; a refusal of its own (the git host's own line) is the error. The pull request's URL and number come back from the git host. The branch's cached "no pull request" answers — the single view and the history — are forgotten, so the page stops offering to open one.

### The "Open PR" button

#### Context

**User story**: on a finished agent's [1] page the user presses "Open PR" and gets the pull request: the existing one when there is one, a new one otherwise, or a clear reason why there is none.

#### Business logic

An agent [1] that recorded no branch is refused with "this session recorded no branch to open a PR from". Otherwise the branch's state is read with the agent's start time, picking the latest pull request that saw the branch. The agent's pull request is the answer first, even when the branch is gone locally — a hands-off [10] agent's branch only ever existed on the remote, and its pull request is what the button exists to give — unless the agent demonstrably moved past it. An agent has moved past its pull request when the pull request is merged or closed and its head commit is known and differs from the branch tip; never for an open pull request (pushed commits still land on it), never when the lookup carried no head commit (a duplicate pull request is not risked on a guess), and never for a gone branch (no tip to compare, so the pull request stays the best answer). Then a branch that no longer exists is refused with "branch <branch> no longer exists", and an empty branch with "this session produced no commits to open a PR for". Otherwise the branch is published by the rule above, ready for review unless the caller asks for a draft, with the title and body rules below. A pull request a human asked for by name is asking for review. The dashboard records the number and URL it gets back on the agent's run [12] card (`../dashboard-rpc/control.ts`).

### The "Push" button

#### Context

**User story**: on a project with no git host package, a finished agent's [1] page offers "Push": the branch reaches the remote, and that is where the handoff [2] ends, since nothing can open a pull request for it.

#### Business logic

An agent [1] that recorded no branch is refused with "this session recorded no branch to push"; a project with no branches provider [14] with "this project has no branches provider to push with". Otherwise the branches provider is asked to push the recorded branch, by the same rule as above, and its refusal is the error. Nothing is opened, no cache is touched. ("Push" on an agent still running is refused with "that session is still going" in `../dashboard-rpc/control.ts`.)

### A pull request for a branch only the remote has

#### Context

**Business logic story**: a cloud session [18] pushes its own `claude/*` branch from a machine this daemon never sees. Cloud work adoption matches that branch to its agent [1] by its descent from the agent's cloud anchor [7], and when the agent was armed for a pull request and the session opened none, opens it with this rule (`../cloud-work.ts`).

#### Business logic

The branch is published by the rule above, always as a draft — a pull request The Framework opens by itself must not request anyone's review, and the intervention [8] feed keeps listing it — with the title and body rules below. The branches provider [14] finds nothing to push for a branch only the remote has and answers it as it is; the git host provider [19] opens the pull request against its own default base.

### The "Merge" button on a finished agent

#### Context

**User story**: an agent [1] left a pull request behind, possibly a draft; the user reads it and presses "Merge": it is good, land it. ("Merge" on an agent still running is refused with "that session is still going" in `../dashboard-rpc/control.ts`.)

#### Business logic

The agent's [1] recorded pull request is resolved by the rule above. No pull request: refused with "this session has no pull request to merge". A pull request that is not open: refused with "this session's PR is already merged" (or "closed"), because that is an answer, not an action. A project with no git host provider [19]: refused with "this project has no git host package to merge with". Otherwise the git host provider is asked to land the pull request by its number — armed to merge on green, merged at once where it is already green, or watched by the provider where the repository allows no auto-merge, a draft marked ready on the way — and a refusal is returned as the provider's own error. On success the branch's cached pull request answers are forgotten, so the page stops offering a merge for a pull request that landed, and the pull request's URL and number are returned.

### The pull request's title

#### Context

**Problem**: a squash merge makes the pull request's title the commit subject on the default branch, permanently. A prompt cut to a title's length would leave the default branch carrying instructions truncated mid-sentence, which describe neither what changed nor a whole thought.

#### Business logic

Three rungs, each a name for the work the agent [1] did: a title the caller hands over as the agent's own, else the agent's branch (the name the agent gave its work, as `branches name` spelled it), else "Session <agent id [9]>", which says little but says it honestly. The prompt the agent was given is never the title. When the caller hands over the GitHub issue the agent's ticket tracks, the reference rides along as "(fix #42)", so the squash-merge commit, which inherits the title, closes the issue. No caller hands over a title or an issue today: the "Open PR" button and cloud work adoption both pass the agent's record, which carries neither.

### The pull request's body

#### Context

See `## Context`.

#### Business logic

A description of the work the caller hands over as the agent's [1] own, because it describes what the change turned out to be; else what the agent was asked for at the start, which is all The Framework knows on its own. No caller hands over a description today. Then, after a blank line, "Opened from The Framework session `<agent id [9]>`." Nothing else.

### What a handoff reports

#### Context

**Problem**: the user pressed a button and waits on its outcome; silence would read as "it ran and did nothing".

#### Business logic

A button action answers with success — and, when a pull request is involved, its URL and number — or with failure and one error line. The dashboard's "Open PR" button records the pull request on the agent's run [12] card (`../dashboard-rpc/control.ts`). The number rides along with the URL because the number is the fact worth recording: every later surface reads it off the agent instead of re-deriving it from branch names and timestamps.
