Publishing an agent's [1] checkout [2]: push its branch, open its pull request with the title and body the agent wrote, and arm the merge when the agent was told the work may land on its own, unless the checkout is under a hold [4], in which case the merge is only recorded as wanted and armed later by a release. The agent's own last step, since the agent publishes its own work.

## Context

**User story**: an agent [1] finishes its work, runs `npx branches publish --title … --body …`, and the user finds the branch on the remote and a pull request open for it; with `--merge`, the request merges by itself once its checks pass, and the user only sees the merged result, in a repository that allows GitHub's auto-merge and in one that does not. When whoever started the agent has more work coming on its branch, the request stays open with a line in its body saying the merge is held, and merges on green only once that work is done.

**Problem**: what is published is what is committed, and nothing is committed on the agent's behalf; a request opened twice for one branch would be noise; a merge armed on a draft is refused by GitHub.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[3] merge watcher: a process of this tool's own, started for one pull request, that waits for its checks and merges it once they pass (`merge-watch.ts`).
[4] hold: a mark put on a checkout [2] by whoever starts the agent, saying more work comes on its branch after the agent; a publish from it that asks for the merge arms nothing (`merge-hold.ts`).
[5] held merge: a pull request whose merge a publish asked for under a hold [4]: recorded as wanted under `.branches/merge-held/<number>`, and armed only by a release.

## Business logic — TL;DR

- **Clean first** - a checkout with uncommitted or untracked files is refused as `dirty` before anything is pushed.
- **Push, then the request** - the branch is pushed to `origin`; a branch that already has an open request gets no second one, and that request is reported as it is.
- **The words are the agent's** - the title and body given are the request's; a draft is opened only when asked and never with an armed merge.
- **Merge on green, on request** - with the merge asked for, GitHub is told to merge the request by squash once its checks pass (`auto-armed`); a request GitHub calls already green is merged at once (`merged`); where the repository does not allow auto-merge, this tool's merge watcher [3] is started for the request (`watching`); any other refusal is reported beside the opened request (`failed`, with gh's line), never as a failed publish.
- **Under a hold, the merge waits** - a checkout under a hold [4] asked to merge opens the request as always, arms nothing, records the held merge [5], puts the held line in the request's body, and answers `held`.
- **The release arms a held merge** - arms the merge exactly as `publish --merge` does, then takes the held line out of the body; `not-held` when no held merge [5] is recorded, `closed` when the request is no longer open; a failed arming keeps the record and the line, so the release can be tried again.
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

When the merge is asked for, the request is opened ready, not as a draft, and GitHub is asked to merge it by squash on its own once its checks pass; the merge's outcome is then `auto-armed`. GitHub refuses to arm in two cases this step answers itself:

- The refusal says the request is in "clean status": nothing is left to wait for, so the request is merged by squash at once, and the outcome is `merged`.
- The refusal says auto-merge "is not allowed" for the repository: the merge watcher [3] is started for the request from the project's root, and the outcome is `watching`; the watcher outlives the agent.

Any other refusal, or a direct merge or a watcher start that fails, is the outcome `failed` with the error's line, reported beside the opened request; the publish itself is still a success, since the request is there. The refusals are matched on those words loosely on purpose: a rephrase on GitHub's side lands in `failed`, said out loud, never in a wrong merge.

### Under a hold, the merge waits

#### Context

**User story**: the user starts an agent from the launcher with "Post-merge cleanup" ticked; the agent publishes with `--merge` as always, and the request stays open until a second agent has cleaned up on the same branch, then merges on green.

**Business logic story**: the scheduler puts the hold [4] on the first agent's checkout [2] before the agent starts; the agent's `publish --merge` answers `held`; the checkout is reclaimed at the run's end, and the record under `.branches/` stays; once the follow-up agent ends done, the scheduler runs the release for the request's number.

#### Business logic

Whether the checkout is under a hold [4] is read only when the merge is asked for, before the push. A publish under a hold that does not ask for the merge is a plain publish: nothing is recorded and no merge outcome is given. A publish under a hold that asks for the merge:

- opens the request ready, not as a draft, like any publish asked to merge;
- for a request it opens, puts the held line (`**Merge held:** more work comes on this branch first; the merge is armed once it is done.`) at the end of the body given, after a blank line, or as the whole body when none was given;
- for a request already open, reads its body and appends the held line when the body lacks it, so the line is there once however many times the publish runs; an edit gh refuses is ignored, since the line is only for a person;
- records the held merge [5] under the project's `.branches/merge-held/<number>`, out of git's sight and outside the checkout, so the record outlives the checkout;
- arms nothing, and answers the merge outcome `held`.

### The release arms a held merge

#### Context

**User story**: the work that was to come on the branch is done; the request loses its held line and merges on green like any request published with `--merge`.

#### Business logic

The release is given the project and a pull request number (`branches release <number>`, or the library call the scheduler makes):

- No held merge [5] recorded for the number: the outcome is `not-held`, and nothing is asked of gh. A release happens once: a successful one drops the record, so a second one is `not-held`.
- gh cannot read the request's state and body: the outcome is `failed` with gh's line, and the record stays.
- The request is no longer open (merged or closed): the record is dropped, and the outcome is `closed` with GitHub's state. A request gh reports with no state is taken as open.
- Otherwise the merge is armed exactly as `publish --merge` arms it: `auto-armed`, `merged`, `watching` or `failed`. `failed` keeps the record and the held line, so the release can be tried again and the request still says its merge is held. After any other outcome the record is dropped, and then the held line is taken out of the body, when it is there (blank lines left behind collapse to one, trailing whitespace goes; an edit gh refuses is ignored).
