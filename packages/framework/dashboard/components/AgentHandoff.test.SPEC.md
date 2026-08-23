What the tests cover:

- **The verdict and the detail** - a finished agent's branch is summarised as its commit and file counts, with the commit subjects and file paths appearing only when the disclosure is open; the branch name is never repeated, since the bar it sits in already says it; nothing at all is rendered before the first read, so no wrong empty state flashes.
- **Nothing to hand off** - an agent that changed nothing says "no changes", offers no disclosure and no button, and states why there is no pull request to open; a branch with no commits but work still in the checkout names the first two uncommitted files, counts the rest, carries the full list on hover, and lists them all in the disclosure — never a button, which the forge would refuse; a branch that is gone, and a project with no remote, each say so instead of offering a dead button.
- **The one next step** - a branch with work offers only Open PR (pushing is not a competing choice, and is not offered once the branch is already pushed); a failed attempt surfaces its reason; an open, unmerged pull request withdraws that offer and becomes Merge PR; a merged or closed pull request offers nothing.
- **Arming the handoff** - a single ticked box, so an agent left alone hands its work back by itself; unticking it means the agent hands off nothing, and ticking it arms the push along with the pull request; the label names the level actually in force — "Push branch" for a push-only agent, "Open PR & merge" for one that will land on the default branch; a click holds until the agent echoes it back, so the box never bounces under the cursor.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
