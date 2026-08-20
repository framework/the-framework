How a finished agent's work is handed back to the human: measure what its branch holds, push it, open a pull request, and decide whether it may merge.

## Flows

- Branch-addressed: an agent reads the same whether or not its checkout still exists, and a locally-gone branch still reports its PR — a hands-off cloud agent only ever pushed remotely.
- An agent that produced nothing — no commits, or only the framework's own bookkeeping — is said so and never published.
- The pull request says what the agent said about the work, when the agent wrote a description for it; otherwise it says what was asked for, which is all the framework knows by itself.
- Push and a draft PR are armed by default; drafts keep the automatic path out of reviewers' inboxes, and uncommitted leftovers are swept into a commit first (guarded so only the agent's own checkout and branch are ever committed).
- The PR number is recorded on the agent the moment one is opened for it, so every surface reads the same integer instead of re-deriving it. Its *state* is still read live, because that changes without the agent doing anything.
- A pull request opened after the agent's process is gone is recorded too, by patching its archive: it is the same fact, and a surface should not have to know which of the two paths produced it.
- A branch that exists only on the remote — a cloud session's own, pushed from a VM this machine never sees — can still get its draft PR opened: there is nothing to push first, the PR request itself is the whole action.
- The branch's own PR history is still consulted for a different question — does this branch already have one — because a branch name pinned by a prompt is reused across agents, so a reused branch never wears an old PR and a branch with one never gets a second.
- Configuration arms an automatic merge; only the agent's declared-done signal plus an empty backlog of its own authorizes it, and a withheld merge still pushes and opens the draft for a human.

## Rationales

- The PR number is written down rather than derived at read time: a lookup across candidate branch names filtered by the agent's start time is a guess standing in for one fact nobody wrote down.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
