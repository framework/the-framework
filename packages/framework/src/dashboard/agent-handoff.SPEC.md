What a finished agent produced, and what is left to do with it. One module answers both halves of the handoff back to the human: the read — the commits, changed files, and publication state (pushed, pull request, merged) a finished agent left on its agent branch — and the actions — push the branch, open a pull request, merge it, commit uncommitted leftovers — including the automatic end-of-agent handoff that publishes a finished agent's work with nobody watching.

## User story

- An agent finishes; the daemon archives it and retires its worktree, leaving the work on the agent branch. The user opens the dashboard and sees exactly what the agent produced — commits, files, line counts — and buttons to push it, open a PR for it, or merge its PR.
- The user is not around. A finished agent left with its defaults pushes its branch and opens a draft PR by itself, so the work is waiting for review when the user comes back. With merge armed and the agent having signalled ready for merge, the PR is opened ready and lands once its checks pass.

## Glossary

- **handoff read** - the record of what a finished agent produced and what can still be done with it: branch existence, base branch, the branch's own commits, changed files with line counts, whether the repo has a remote, whether the branch is pushed and merged, its pull request, and any uncommitted leftovers.
- **bookkeeping** - The Framework's own records under `.the-framework/` (conversation records, logs), committed onto the agent branch for provenance, never as publishable work.
- **armed** - what the agent was configured to do on its own when it ends: push and open a PR are both armed by default; merge is a separate arm, off unless the agent's config turns it on.

## Business logic — TL;DR

- **The handoff read is branch-addressed** - a finished agent is read from the project repo by its branch name, so it reads the same whether or not its checkout still exists — and a branch that is gone locally still answers with its PR, which may be the one thing left worth showing.
- **"Produced nothing" is said out loud** - a branch with no commits of its own, or with nothing changed beyond framework bookkeeping, is reported empty rather than shown as an empty branch with buttons that would publish nothing.
- **Uncommitted leftovers are named, and committable** - work sitting uncommitted in the agent's own checkout is listed by file path, and a finishing action sweeps it into a commit — guarded so it can never commit the user's own dirt.
- **The agent's branch and PR are recorded facts** - the branch is the one recorded while the agent ran; the PR is the number the agent recorded when one was opened. Live lookups only refresh the PR's state, and a predecessor's PR wearing the same branch name is never mistaken for this agent's.
- **Manual actions** - Push publishes the branch; Open PR pushes first and opens the PR ready for review; Merge lands the agent's open PR, marking a draft ready on the way. Refusals come with the reason ("already merged" is an answer, not an action), and failures surface git's own reason rather than an echoed command.
- **Auto-handoff** - the end-of-agent handoff the agent was left armed for: it skips (with a stated reason) everything that is not a clean hand-off, opens its PR as a draft so it puts no review request in anyone's inbox, never opens a second PR for a branch with an open one — and gives work committed after a PR merged or closed a fresh PR of its own.
- **Config arms the merge, the agent authorizes it** - an armed merge is withheld unless the agent declared the work done via ready for merge and its own TODO file is settled; a withheld merge still pushes and opens a draft PR.
- **The PR says what the agent said** - title and body come from the agent's own naming and description of the work where it wrote them, with the ticket's GitHub issue reference riding along so a squash merge closes the issue.

## Business logic

### The handoff read is branch-addressed

#### User story

See `## User story`: the dashboard must show what a finished agent produced. The common end state has no worktree left — a clean finish archives the agent and removes its checkout, leaving only the branch.

#### Business logic

The read takes a branch name and answers from the project repo, so a finished agent reads the same whether or not its checkout still exists. It reports: whether the branch exists; the base it is measured against (the branch the remote points its HEAD at, else a conventional local default branch); the branch's own commits; the files changed since the branch point, with per-file insertions and deletions (binary files flagged, since line counts are meaningless there); whether the repo has a remote at all; whether the branch is pushed (the remote holds it at the same commit); whether it is already merged into the base; and the branch's pull request.

Forgiving throughout: a directory that is not a git repo yields no handoff at all; a project with no remote or without GitHub tooling yields a handoff with less in it, never an error. A branch that no longer exists still returns a handoff saying so — "that branch is gone" is itself the answer the dashboard needs — and its PR is still looked up, because the branch being gone locally does not mean the work is: a hands-off web agent pushes its branch and opens its PR remotely, and a merged branch gets deleted, so the PR is the one thing left worth showing.

#### Rationale

Two different git comparisons answer the two questions, and mixing them was a real bug: the commit list must count only the branch's *own* commits, because a symmetric-difference read also counts commits that exist only on the base — a branch whose work was already merged then reported commits it never made, was not reported empty, and the dashboard offered an Open PR that GitHub could only refuse with "no commits between the base and the branch". The file diff, by contrast, is correctly measured since the branch point rather than against a base that has moved on since.

### "Produced nothing" is said out loud

#### User story

An agent that changed nothing is a real outcome. It must be stated as such, not rendered as an empty branch with buttons that would push nothing or open an unopenable PR.

#### Business logic

A handoff is empty when the branch carries no commit the base does not already have, or when every changed file is framework bookkeeping. The files decide, not the commits: a branch holding only bookkeeping sweeps has commits and still nothing to hand off. Empty is a hard stop for publication — auto-handoff skips it, and the Open PR action refuses it with the reason.

#### Rationale

Every agent branch carries The Framework's own paper trail: the pre-work commit sweeps in the conversation record the daemon just wrote. Publishing that alone produced junk PRs of pure bookkeeping, so bookkeeping-only counts as nothing. Bookkeeping alongside real work does not make a branch empty.

### Uncommitted leftovers are named

#### User story

The agent is told to commit its work, but one that ends without doing so holds its entire output as uncommitted changes in its checkout, with the branch itself empty — and nothing commits it on the agent's behalf.

#### Business logic

When the caller names the agent's own checkout, the handoff read lists the files sitting uncommitted there, by path. It lists paths rather than a count because a no-commit branch must *name* what is waiting instead of offering an Open PR that GitHub can only refuse. The field is absent — not an empty list — when no checkout was given: "nobody asked" and "asked, tree clean" are different answers, and only the second may be rendered as a clean tree.

Those leftovers are only ever named, never committed by The Framework: the user commits them in the checkout, or deletes the checkout with them.

### The agent's branch and PR are recorded facts

#### User story

Every surface that shows an agent's work needs to know which branch it is on and which PR is its — without guessing, and without mistaking a predecessor's PR on a reused branch name for this agent's.

#### Business logic

The branch is the one recorded while the agent's worktree existed — authoritative because the agent renames its branch itself, which makes any derivation a guess. For an agent whose branch was never recorded (one started outside a git checkout) the birth branch `tf-agent-<agent id>` is the one fallback.

The PR is the number the agent recorded at the moment one was opened for it. The live lookup only refreshes that PR's *state*, which changes without the agent doing anything (a PR merges, a human closes it) — a different PR number found on the branch is some other PR and never this agent's answer, and a recorded PR the live read cannot confirm (a branch this machine cannot see) still answers with its recorded number and URL, state unknown. An agent that recorded no PR costs no lookup at all.

Where no PR was recorded, the branch's whole PR history is filtered by the agent's start time: an open PR always counts (GitHub allows one open PR per head branch, so it is where pushed commits land), a closed one counts only when created after the agent started, and without a start time only an open PR is trusted. This is what keeps a predecessor's merged PR, wearing the same branch name, from showing as a fresh agent's own.

Separately, whether a branch is an agent's at all is judged by its naming prefix. That is only a convention — the agent may name its branch anything — so every caller uses it to decide how loudly to surface something, never to act.

Live PR state rides the dashboard's read-through cache, and "not known yet" is reported distinctly from "no PR" so a surface can ask again rather than render an absence.

#### Rationale

The recorded number replaced a three-way branch-name ladder plus a timestamp heuristic — three sources and a guess, standing in for one integer nobody had written down.

### Manual handoff actions: Push, Open PR, Merge

#### User story

See `## User story`: the buttons on a finished agent. Publishing the agent's work under the user's name is the user's call — made once, up front, by the armed defaults; the buttons remain for an agent that opted out, and as the retry when an automatic step failed.

#### Business logic

**Push** publishes the agent branch to the repo's remote. A failure comes back as the line of git's own output worth showing (its fatal/error/remote line) rather than the command echoed back, and a timed-out push says it timed out rather than reading like a rejection.

**Open PR** pushes first — GitHub refuses a PR for a branch its remote has never seen — then opens the PR *ready for review*: a PR a human asked for by name is asking for review. The base is passed as the branch name GitHub accepts, converted from the remote-tracking spelling the handoff read holds. Decision order for an agent: an existing PR that still covers the branch tip is returned as the answer instead of opening a second one — even when the branch is gone locally, since a hands-off web agent's PR is the answer the button exists to give; a branch that no longer exists is a clear error; an empty handoff is refused. The new PR's number is read off the URL GitHub tooling prints and returned, so it can be recorded on the agent.

A separate action opens a draft PR for a branch that exists *only* on the remote — a cloud session's own branch, pushed from a machine this daemon never sees. There is nothing local to push, the repo's default base applies, and it is a draft because The Framework opened it by itself.

**Merge** lands the agent's open PR — the human saying "it's good, land it" for an agent that never signalled ready for merge and so left a draft PR behind. A draft is marked ready on the way. It refuses an agent with no PR, and a PR that is no longer open: "already merged" is an answer, not an action. Merging arms GitHub auto-merge (squash) first so the PR lands when its checks pass rather than before them.

After any action that changes a branch's PR situation, that branch's cached PR reads are dropped — otherwise the dashboard would keep offering to open a PR that exists, or to merge a PR that landed, until the cache aged out.

### Auto-handoff

#### User story

See `## User story`: a finished agent left alone publishes itself. The point of arming push and PR by default is that the common case costs nothing — an agent that is simply left alone puts its branch on the remote and opens a PR for it.

#### Business logic

The end-of-agent handoff does what the agent was left armed for: push the branch, open a PR (which subsumes the push), or both — and, when merge is armed, land the PR too. It reads the handoff first and *skips*, each with a stated reason, everything that is not a clean hand-off: nothing armed; the branch gone; nothing committed (bookkeeping-only included); no remote; an open PR already covering the branch; or a closed or merged PR that already landed the branch tip. Skips are reported rather than silent, and the whole outcome travels as an event — a dashboard-started agent prints to nobody, so what does not travel as an event does not travel at all.

The PR opens as a *draft*: a PR The Framework opens by itself at the end of every agent must not put a review request in anyone's inbox. That is safe only because the interventions list keeps listing an agent's draft, so the work still comes back to the human.

Opening a second PR on a branch that already has an open one is the one mistake this must never make. But a merged or closed PR only covers the branch up to the head it carried: when the agent demonstrably kept committing past it, the old PR is not the answer — the post-close work gets a fresh PR, or it reaches nobody. Without a recorded PR head to compare against, the safe answer is to skip and never risk a duplicate.

With merge armed: the PR opens ready instead of draft (GitHub refuses to merge drafts — the review of this work happened before the agent ran, which is the same reason merge is armed at all), and the merge arms GitHub auto-merge so the PR lands when its checks pass. Where the repo does not allow auto-merge, the PR is handed to the daemon's CI watch to merge on green rather than merged directly before its first check runs. When a rerun or a daemon restart finds the open PR a predecessor opened, no second PR is opened but the merge half — the half that has not happened yet — still runs against it.

Failures are reported per step (push or PR) with git's own reason, so the dashboard can offer the retry. A merge that fails rides along on a handoff that still succeeded: the PR exists either way, and a human can merge it by hand.

#### Rationale

Auto-handoff asks GitHub for the branch's PRs directly instead of through the dashboard's cache: the cache answers "not known yet" while warming, which is right for a panel repainting every few seconds and wrong here — "not known yet" would read as "no PR" and open a duplicate. This runs once, at the end of an agent, so it can afford to wait for a real answer. And it asks for the *latest* qualifying PR rather than the agent's first one, because the moved-past decision compares the branch tip against a PR's head, and only the last PR that saw the branch answers that — against the first, work a second PR already landed would read as unlanded and reopen.

### Config arms the merge, the agent authorizes it

#### User story

Landing work on the default branch unattended is the highest-consequence thing the handoff can do; it takes more than a config flag.

#### Business logic

An armed merge is withheld unless two things hold: the agent declared the work done via its explicit ready for merge signal — no signal, no merge, whatever else is true — and the agent's own TODO file holds no open work (never the shared agent queue, which is decoupled from any one agent). A withheld merge is not a failed handoff: push and PR go ahead, and the PR simply opens as a draft for a human. The withholding reason is stated.

#### Rationale

The TODO check is a temporary safety belt on top of the agent's word; the agent's declaration should ultimately be enough.

### The PR says what the agent said

#### User story

The PR is what the human reviews, and — under squash merge — its title becomes the commit subject on the default branch forever.

#### Business logic

The title has three rungs, each a name for the work: what the agent itself called the change, else the session name the agent's branch carries, else `Session <agent id>` — which says little, but says it honestly. When the agent implements a ticket that tracks a GitHub issue, the issue reference rides along in the title as `(fix #<issue>)`, so the squash-merge commit — which inherits the title — closes the issue; without it an auto-merged quick win leaves its ticket open.

The body is the agent's own description of what the change turned out to be where it wrote one, else what was asked for at the start (the agent's intent — the best The Framework can say by itself), plus a line naming which session did it.

#### Rationale

The prompt the agent was given is deliberately not a title rung. It used to be, cut to 72 characters, and squash merges made that permanent: the default branch ended up carrying instructions truncated mid-sentence as commit subjects — describing neither what changed nor even a whole thought.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
