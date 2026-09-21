Opening a branch's pull request: the agent's own step after its branch is pushed, and the dashboard's on a person's "Open PR". The words are the caller's; pushing is not here, the branches package pushes.

## Business logic — TL;DR

- **Which branch** - the one named, else the current branch of the working directory; a detached working directory with no branch named is refused as `no-branch`.
- **No second request** - a branch that already has an open pull request gets no new one: that one is answered, marked `existing`, and only the merge arming happens.
- **The request** - `gh pr create` with the head branch, the title and the body given (an empty body when none); as a draft only when asked and the merge is not armed, since a draft cannot merge; the number is read off the URL gh prints, else off a second listing; gh refusing (a branch not on the remote, no commits against the base) is `open-failed` with gh's line.
- **Merge on green, on request** - with `--merge` the merge is armed as `merge.ts` arms it; an arming that fails is `merge-failed`, the open request named beside it, since the request exists and only its merge is owed.
