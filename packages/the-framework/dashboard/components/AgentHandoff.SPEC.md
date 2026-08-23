The end-of-work handoff, spread across an agent's action bar: a one-line verdict of what the agent's branch holds, the pre-commitment of what will happen to that work when the agent settles, the next step offered as a button once it has settled, and — behind the bar's disclosure — the commits, the changed files and anything left uncommitted.

## User story

A finished agent used to show no branch, no commits and no diff, so finding out what it had actually done meant leaving the dashboard for the command line, and the work quietly piled up on a local branch nobody was told about.

## Business logic — TL;DR

- **The verdict, in one line** - how many commits and files the branch holds and how many lines they add and remove, or plainly "branch gone" or "no changes"; whether the work is pushed, and whether it is merged.
- **The handoff is armed, not clicked** - while the agent runs, one checkbox states what it will do with its work when it settles; whatever is still ticked happens by itself.
- **The box always names what will happen** - it reads "Push branch", "Open PR" or "Open PR & merge" according to the handoff level actually in force; unticking it means the agent hands off nothing, and re-ticking it lands on opening a pull request.
- **The next step is offered, not described** - once the agent has settled without handing itself off, the bar carries the one button that finishes the job: Open PR, or Merge PR when an open pull request is only waiting to land.
- **When nothing can be pressed, the bar says why** - branch gone, nothing committed (naming what is left uncommitted), or no remote to push to.
- **The detail is one disclosure away** - the commits, the changed files with their line counts, and the uncommitted paths, each capped with the remainder counted rather than silently dropped.

## Glossary

- **handoff level** - how far a finished agent publishes itself, as one ladder: keep it local, push the branch, open a pull request, or open and merge it.

## Business logic

### The verdict

#### User story

The user glances at an agent and wants to know what it left behind, without opening anything.

#### Business logic

Beside the branch, the bar states how many commits and how many files the branch holds and how many lines they add and remove. A branch that no longer exists and a branch that holds no changes are told apart explicitly — "branch gone" versus "no changes" — because they are different facts. Work that has reached the remote but has no pull request says "pushed"; work that landed says "merged". The pull request itself is not repeated here, since the bar already links it.

### Arming the handoff

#### User story

The user wants a finished agent's work to reach a pull request without having to come back and press anything, but must also be able to keep a piece of work to themselves.

#### Business logic

While the agent is live, the bar carries a single checkbox stating what the agent will do with its work when it settles — a pre-commitment, not a button: whatever is still ticked happens on its own. It starts ticked, so the common case costs nothing. Its label always names the handoff level actually in force: "Push branch" for an agent set to push only, "Open PR" for one that will open a pull request (pushing the branch on the way), and "Open PR & merge" for one that will also land it; hovering explains each in full. Unticking means the agent hands off nothing; ticking again opts into opening a pull request rather than restoring a merge the box never mentioned. The change is shown immediately and holds until the agent's own events confirm it. Once the agent has settled the box is gone: the decision has been taken, and what matters then is what happened.

#### Rationale

Push and pull request were once two boxes side by side, which allowed a state that read as a contradiction (a pull request armed without a push) and offered "push without opening a pull request", which nobody could put a purpose to. Opening a pull request is the outcome and pushing is how it gets there, so one box names whichever the agent is actually set to do.

### The next step

#### User story

An agent that opted out of the handoff, or whose automatic handoff failed, leaves work sitting on a branch; publishing it is one deliberate act the user should not have to go looking for.

#### Business logic

Once the agent has settled, the end of the bar offers the single step that moves the work forward, and it sits in the bar rather than behind the disclosure so it is offered without being looked for.

- While it is not yet known whether the branch has a pull request, nothing is offered — acting on "not known yet" is how a second pull request gets opened.
- With an open, unmerged pull request, the button is Merge PR, so the ending that deliberately withholds the merge takes one human click to land.
- With a pull request that is closed or already merged, nothing is offered: the bar links it, and the interventions list has it by then.
- Otherwise the button is Open PR, which pushes the branch on the way.

Each action reports its own failure, and reads back what it is doing while it is in flight.

### Why there is nothing to press

#### User story

An agent that finished and offers no control at all is exactly the case where the reader needs to be told why.

#### Business logic

In place of the button the bar states the reason: the branch is gone, so there is nothing to open a pull request from; nothing was committed, so there is no pull request to open — and when the checkout still holds uncommitted work, the first couple of those paths are named with the rest counted, since the reader's next step is to have the agent commit them (an unattended agent commits them by itself on the way out); or the project has no remote to push to. The reason is capped in width so a long path ellipsizes rather than widening the bar, and the full list of uncommitted paths is one hover away.

### What the branch holds

#### User story

Having seen that the agent produced something, the user wants to see what.

#### Business logic

The bar's disclosure lists the branch's commits (short hash and subject), its changed files with each file's added and removed line counts — or "binary" where a diff means nothing — and, separately, the files left uncommitted. Each list is capped, and whatever it does not show is counted as "and N more" rather than dropped silently. A list with nothing in it is omitted entirely, so no heading ever stands over nothing, and the disclosure is not offered at all for an agent whose branch is gone or that changed nothing and left nothing uncommitted.

#### Rationale

Everything shown here is read by branch rather than from the agent's checkout, so it survives a clean agent's worktree being reclaimed when it ends.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
