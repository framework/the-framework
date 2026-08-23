The data branch `tf-data`: the one branch of a project's repository that holds everything The Framework itself writes — the tickets, the agent queue, the agent archives — so the project's own branches stay 100% code. This is where that branch is created, kept in step with the remote, written to, and read from.

## User story

The user works from two machines and lets agents run in the cloud. The roadmap, the agent queue and the history of what ran must look the same everywhere, must never end up mixed into the code they review, and must never be silently overwritten by a machine that had an older copy.

## Business logic — TL;DR

- **One branch for the framework's own files** - everything The Framework writes lives on `tf-data`, the way a site's published files live on their own branch, so the code branches carry no framework data.
- **The branch is born unattached to the code** - its first commit has no parent and no content, so no code commit is ever an ancestor of the data history.
- **Its checkout, and the roadmap shortcut** - the branch is checked out under `.the-framework/branches/tf-data`, and the repo root gets a `tickets` link into it that git is told to ignore.
- **One local writer, one funnel** - every local write goes through a single cycle per project — sync, apply, commit, push — serialized so two of them can never interleave.
- **A write is an intent, not a commit** - the change is re-applied against fresher state when the push loses a race, rather than force-fitting a stale commit.
- **A push is owed until it lands** - a commit that could not be pushed stays local and is carried by the next cycle.
- **Conflicts resolve toward the remote** - the checkout is nobody's working tree, so the remote always wins and the local intent is re-applied on top.
- **The eager pull** - the branch is pulled on a schedule so this machine sees what other machines and cloud sessions wrote, without waiting for a local write.
- **A repo with no remote** - fine for a write, an error for a sync: data nobody else can reach is a state the user has to fix.
- **Reading from anywhere in the repo** - an agent in its own checkout reads the same data without holding a copy of it.

## Business logic

### One branch for the framework's own files

#### User story

The user reviews a pull request and sees only code — no ticket churn, no queue edits, no bookkeeping about which agent ran when.

#### Business logic

Every file The Framework itself writes — the tickets, the agent queue, the agent archives — lives on one branch of the project's repository, `tf-data`. Because nothing on that branch is anyone's working tree, it is safe to push and pull eagerly, which is what gives every machine and every cloud session the same view: fetch the branch, read the files, commit onto it, push.

The branch is created from the remote's copy when there is one — the case on every machine after the first — and otherwise born locally.

#### Rationale

Two problems disappear structurally with this arrangement. An agent can no longer clobber a freshly-merged queue with its own stale copy, because there is one queue, on one branch, with one local writer. And an agent's bookkeeping can no longer be stranded on a local code branch, because data commits land on a branch whose entire job is to be pushed.

### The branch is born unattached to the code

#### Business logic

When the branch has to be created locally, its first commit is empty and has no parent. No code commit is ever an ancestor of the data history, and creating it touches no checkout at all.

### Its checkout, and the roadmap shortcut

#### User story

The user wants to read the roadmap by listing the repository, not by learning where the framework hides it.

#### Business logic

The branch is checked out at `.the-framework/branches/tf-data`, named after its branch like every other checkout there. The repository root gets a `tickets` link pointing into that checkout, so the roadmap is one listing away.

The link is created only where nothing already exists — a real `tickets` directory from before, or a file of the user's own, is left alone. Because the link is framework state and lives uncommitted at the repository root, it is hidden from git the moment it is made, or it would ride along on any sweeping commit onto a code branch. Hiding it takes a pair of rules, because the repository-level ignore speaks for every checkout at once — including the data checkout, whose own root holds the real `tickets` directory the branch exists to carry: one rule hides root entries of that name, and a second re-includes directories, which never matches a link. So the link stays hidden while the data checkout's own directory keeps being committed.

A branch born empty is seeded with an empty agent queue file, so readers and humans find a file rather than a mystery. The seed is committed immediately, so the checkout is clean between cycles and no later write's commit message misrepresents what it carried; its push is owed like any other local commit.

Setting all of this up is idempotent and cheap when it is already in place, and never fails outright: a project this cannot be set up in reports why and is otherwise left alone.

### One local writer, one funnel

#### User story

Two background jobs write the queue in the same moment. Neither may see, or commit, a half-written state.

#### Business logic

The daemon is the single local writer, and every local write goes through one cycle: make sure the branch and its checkout exist, sync with the remote, apply the change, commit whatever it changed, push. Cycles are serialized per project, so two of them can never interleave — including the scheduled pull, which is the same cycle applying no change.

An agent that writes data is treated as a remote writer, like another machine: it commits onto the branch in its own checkout and pushes, and the race between them is settled by the push itself — whoever loses re-syncs and re-applies.

A cycle never fails outright, because its callers run on background ticks with nobody to catch a failure. When the change itself fails, the checkout is put back to its committed state first, so half-written files cannot ride along on a later, unrelated commit.

### A write is an intent, not a commit

#### User story

Another machine pushes to the data branch in the instant between this machine's sync and its push.

#### Business logic

A change is expressed as something re-runnable, not as a fixed commit. When the push loses the race, the cycle syncs again and re-applies the change against the fresher state rather than force-fitting a stale commit — the change is the intent, the commit is only its serialization. It tries twice; a push that still fails, most likely for want of a network, keeps the commit locally and reports that it did, so the caller knows the change survived even though it is not yet shared.

### A push is owed until it lands

#### Business logic

Whenever the local branch has commits the remote does not, the cycle pushes — even when this particular change wrote nothing new. That is what carries out the commits an earlier failed cycle left behind. A cycle that finds nothing to write and nothing owed reports that it changed nothing.

### Conflicts resolve toward the remote

#### Business logic

Syncing fetches the remote's copy and replays whatever local commits exist on top of it. When that cannot be done cleanly, the local checkout is reset to the remote's state outright. Nothing is lost by that, because the local intent is re-applied immediately afterwards by the cycle that is running — the whole design rests on changes being re-runnable.

### The eager pull

#### User story

The user's other machine, or a cloud session, added a ticket ten minutes ago. This machine has to see it without anyone writing anything here first.

#### Business logic

The branch is pulled on a schedule: the same cycle, applying no change, which converges the checkout with the remote and pushes anything a failed cycle left stranded locally under the same owed-push rule. It also creates the checkout if there is none, so a freshly cloned repository converges on its first turn.

The pull reports why it could not converge, and the daemon records that as the project's error state so it reaches the dashboard rather than only the terminal.

### A repo with no remote

#### Business logic

A repository with no remote is fine for a write — the commit is safe locally — but it is an error for a sync, whose entire job is to meet the other machines. A repository nothing else can reach is a state the user has to fix, not a mode the framework supports, so the sync says so explicitly.

### Reading from anywhere in the repo

#### User story

An agent working in its own checkout needs to read the agent queue, and a freshly cloned machine needs to read it before the branch has been created locally.

#### Business logic

A file on the data branch is read from the data checkout when this location has one; otherwise from the local branch directly, which is how an agent's own checkout reads the same data without holding any of it, since checkouts of one repository share its refs; otherwise from the remote's copy of the branch, which is the case on a machine that has fetched but never created the branch locally. A file that exists in none of them simply reads as absent, and a read never fails outright.

A read can ask for a fresh copy, which fetches first and prefers the remote's version. That is for a reader about to act on the queue from a long-lived agent process, where the local ref may trail what other writers have pushed.

Anywhere inside a repository — including an agent's own checkout — the project the data lives in is identified as the directory holding the repository's real git storage, which is the address every data write funnels to.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
