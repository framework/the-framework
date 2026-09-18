Publishing an agent's [1] checkout [2]: push its branch, open its pull request with the title and body the agent wrote, and arm the merge when the agent was told the work may land on its own. The agent's own last step, since the agent publishes its own work.

## Context

**User story**: an agent [1] finishes its work, runs `npx branches publish --title … --body …`, and the user finds the branch on the remote and a pull request open for it; with `--merge`, the request merges by itself once its checks pass, and the user only sees the merged result.

**Problem**: what is published is what is committed, and nothing is committed on the agent's behalf; a request opened twice for one branch would be noise; a merge armed on a draft is refused by GitHub.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.

## Business logic — TL;DR

- **Clean first** - a checkout with uncommitted or untracked files is refused as `dirty` before anything is pushed.
- **Push, then the request** - the branch is pushed to `origin`; a branch that already has an open request gets no second one, and that request is reported as it is.
- **The words are the agent's** - the title and body given are the request's; a draft is opened only when asked and never with an armed merge.
- **Merge on green, on request** - with the merge asked for, GitHub is told to merge the request by squash once its checks pass; a refusal is reported beside the opened request, never as a failed publish.
- **Every refusal names why** - not a worktree, no branch, dirty, the push did not land (with git's line), the request could not be opened (with gh's line).

## Business logic

### Clean first

#### Context

See `## Context`.

#### Business logic

The directory must be a git worktree root on a branch, and its tree must be clean: anything uncommitted or untracked refuses the publish as `dirty`, naming the branch, and nothing is pushed.

### Push, then the request

#### Context

**Problem**: GitHub refuses a pull request for a branch the remote has never seen.

#### Business logic

The branch is pushed to `origin` with its upstream set; a push that does not land is the refusal `push-failed`, with git's own line. Then the open pull request of the branch is looked up; when there is one, it is the result, marked as existing, and no request is opened. Otherwise one is opened with `--head`, the title and the body given; the number and the address are read off the line gh prints, or looked up again when gh printed none. A request gh refuses is the refusal `pr-failed`, with gh's own line.

### Merge on green, on request

#### Context

**User story**: work that was triaged onto the queue by a person before any agent touched it may land without a second look; the command that started the agent says so, and the agent passes it on.

#### Business logic

When the merge is asked for, the request is opened ready, not as a draft, and GitHub is asked to merge it by squash on its own once its checks pass. A refusal to arm is reported as the merge's outcome beside the opened request, with gh's line; the publish itself is still a success, since the request is there.
