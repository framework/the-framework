Hands a finished agent's work back to the user: measures what its branch holds, pushes it, opens a pull request, and decides whether it may merge.

## User Stories

- The user finds a settled agent's branch pushed and a draft pull request opened for it, without pressing anything.
- The user is told when an agent produced nothing; an empty agent is never published.
- The user reads a pull request written by the agent that did the work — titled with what the change does, not with the instruction the agent was given — instead of a restatement of the request.
- The user pushes, opens the PR, or merges by hand from the handoff panel — the merge button lands the draft an automatic merge withheld.
- The user arms an automatic merge in configuration, and it still waits for the agent's own ready signal.
- The user sees a cloud agent's pull request even though its branch never existed on this machine.

## Flows

- The read is addressed by branch, not by checkout: an agent reads the same whether or not its checkout still exists. A branch gone locally still reports its pull request — a hands-off cloud agent only ever pushed to the remote.
- An agent that produced nothing — no commits, or changes only to the framework's own records — is reported as empty and never published.
- The pull request describes the work in the agent's own words, when the agent wrote a description for it; otherwise it repeats what the user asked for, which is all the framework knows by itself.
- The pull request is titled with the agent's own name for the work, else with the session's name, else with the session's id. The prompt the session was given is never a title: a squash merge turns the title into the permanent commit subject, and an instruction cut mid-sentence describes neither what changed nor a whole thought.
- Push and a draft PR are armed by default; drafts keep the automatic path out of reviewers' inboxes. Whatever the agent left uncommitted is swept into a commit first, guarded so only the agent's own checkout and branch are ever committed.
- The PR number is recorded on the agent the moment one is opened for it, so every surface reads the same integer instead of re-deriving it. Its *state* is still read live, because that changes without the agent doing anything.
- A pull request opened after the agent's process is gone is recorded too, by patching the agent's archived record: it is the same fact, and a surface should not have to know which of the two paths produced it.
- A branch that exists only on the remote — a cloud session's own, pushed from a VM this machine never sees — can still get its draft PR opened: there is nothing to push first, the PR request itself is the whole action.
- The branch's own PR history is still consulted for a different question: does this branch already have a pull request. A branch name pinned by a prompt is reused across agents, so the history is filtered by the agent's start time — a reused branch never shows an earlier agent's PR, and a branch that already has one never gets a second.
- Configuration arms an automatic merge; it runs only when the agent has signalled ready for merge and the agent's own TODO backlog is empty. A withheld merge still pushes and opens the draft PR for the user.

## Rationales

- The PR number is written down rather than derived at read time: a lookup across candidate branch names filtered by the agent's start time is a guess standing in for one fact nobody wrote down.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
