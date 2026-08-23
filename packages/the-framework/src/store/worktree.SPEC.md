The lifecycle of an agent's own checkout: creating it, naming its branch, committing whatever the agent left behind, deciding whether it is safe to delete, and deleting it. Giving every agent its own checkout is what lets several agents work one repo at once without fighting over a single working tree.

## User story

- The user starts several agents on the same project at the same time and each works undisturbed.
- The user's uncommitted work is never destroyed by the framework tidying up after an agent.
- The user's disk does not fill with the checkouts of agents that finished long ago.

## Business logic — TL;DR

- **One checkout per agent, under the project's own directory** - each agent's checkout lives at `.the-framework/branches/<agent branch>`, named after its branch.
- **A new agent branches; a continued agent re-attaches** - continuing an agent puts it back on the branch its work is already on rather than branching again.
- **The branch is renamed once the agent names itself** - the checkout is created before a session name exists, and gains the readable name afterwards.
- **Teardown commits before it deletes** - work the agent left uncommitted is committed onto the agent's branch first, and a checkout that cannot be committed is kept.
- **Nothing local is ever the last copy of work** - a checkout may be deleted only when the remote already has its branch tip.
- **Every read is forgiving; every removal is idempotent** - a git failure yields "unknown" rather than breaking the caller, and removing a checkout twice is harmless.

## Business logic

### One checkout per agent

#### User story

The user runs three agents against one repo simultaneously and none of them sees another's edits, staged files, or branch switches.

#### Business logic

An agent's checkout sits inside the project at `.the-framework/branches/`, in a directory named after the agent's branch. The agent id is required to be path-safe before it is ever used to build that path, so no caller can place a checkout outside that directory.

Creating a checkout for a new agent creates its branch at the same time, from a stated base or from the project's current head. Creating a checkout for a continued agent instead attaches the branch that already exists, so the agent resumes on top of what it did last time rather than branching afresh and stranding it. Either failure is raised rather than swallowed: an agent that cannot get its checkout cannot run.

Everything the repo has registered as a checkout can be listed, the main checkout included, together with the commit and branch each has. A project that is not a repo, or a git failure, yields an empty list, so a reconciliation scan never breaks. Administrative leftovers from checkout directories a crash removed can be pruned; pruning never touches a live checkout.

A checkout's size on disk can be read, best-effort. It only ever labels a "remove this" button, so a number that cannot be read — including on a platform without the tool that measures it — is simply unknown, which costs nothing, while a failure or a hang would cost the whole panel it sits in. The measurement does not follow the linked dependency trees, so an agent's checkout is not reported as the size of the whole dependency store.

### The branch is renamed once the agent names itself

#### User story

The user reads their branch list and sees `tf-add-comments`, not a timestamp.

#### Business logic

An agent's checkout is created on `tf-agent-<agent id>` because no session name exists yet. Once the agent picks one, the branch is renamed to `tf-<session name>`.

The rename happens only if the checkout is still on the original branch. The agent is itself instructed to create and check out its own named branch, so it may have moved off already — in which case it named the branch itself and there is nothing to rename. The rename never fails an agent: a name already taken, or an invalid one, simply leaves the agent on its original branch.

The branch a checkout is currently on can be asked for at any time, answering "unknown" for a detached checkout or one that is not a repo, since callers use the answer to decide rather than to fail.

### Teardown commits before it deletes

#### User story

The agent edits files and stops without committing. The user must still be able to see and keep that diff.

#### Business logic

An agent that edits and stops without committing is behaving as instructed: it is told to commit pre-existing changes before it starts, never its own work at the end. Removing its checkout would destroy that diff outright, because unstaged work is not recoverable from git afterwards. So teardown commits whatever is left onto the agent's own branch first, and the branch outlives the checkout. The commit is worded identically to the framework's install-time safety commit, so the user sees one vocabulary.

The answer teardown acts on is "is this checkout safe to remove": yes when it was already clean or the work is now committed, no when the commit failed — a missing git identity, or a hook refusing it. A no means keep the checkout, which is the safe direction.

The commit is retried a few times before giving up, because the daemon's own committer works in the same checkout and is at its busiest exactly when an agent finishes; a first attempt can lose the race for git's lock. A short wait outlasts that hold, while a persistent failure still answers no.

Separately, a checkout can be asked whether it is clean without committing anything. That read exists for a decision that must not commit on its way to an answer: deciding whether to remove the checkout of an agent that published nothing needs a clean tree, and sweeping up someone's half-typed edits into a commit to find that out would be exactly the intrusion the question exists to avoid. When git cannot answer, the caller keeps the checkout rather than guessing.

#### Rationale

Retrying was added because losing that lock race once made a real agent's work be judged as "committed nothing" by its handoff, while the teardown's identical commit seconds later succeeded.

### Nothing local is ever the last copy of work

#### User story

The user's disk is reclaimed automatically, and no agent's work ever disappears with the checkout it was in.

#### Business logic

The single question every retention decision asks is whether the branch is on the remote *with the local tip already there*. The remote-tracking reference merely existing is not enough: a branch that was pushed and then committed to again has a tip the remote has never seen, so the local tip must be contained in the remote one. Only local references are read — no fetching — which is what makes it cheap enough to ask on every teardown; that is sound precisely because the remote reference is written by the very push being checked for.

Anything unreadable answers no. A repo with no remote configured therefore keeps every checkout, which is the honest outcome: there is nowhere for the work to be recoverable from. A sweep asks once per project whether the repo has any remote at all, because with none the whole per-checkout probe-and-push cycle is doomed before it starts and the answer cannot change between two checkouts of the same sweep.

#### Rationale

This one predicate replaced three interacting rules — a clean finish removes the checkout, a failure keeps it, a merged branch reclaims it later. Each of those asked "what state did this agent end in" rather than the question that actually matters: "is this work recoverable".

### Removal is idempotent, and forcing is announced

#### User story

Teardown never leaves a stranded checkout behind, and never silently deletes something unexpected.

#### Business logic

Removal tolerates a path that is already gone or was never registered, so teardown can run more than once. Plain removal is attempted first, because git refuses it for a checkout it considers unclean — which, after the commit step, means a state that was not anticipated. Removal is then retried forcefully so that, for example, an ignored build artifact cannot strand a checkout forever, but the forced removal is logged, because forcing past unknown state is exactly how uncommitted work was destroyed before.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
