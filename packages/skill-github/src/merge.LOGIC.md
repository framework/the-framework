Landing a pull request: how a merge is armed, and the door a person or `agent-runner` uses to land one by number.

## Business logic — TL;DR

- **Arming a merge** - GitHub is told to merge the request by squash once its checks pass (`auto-armed`); when GitHub answers that the request is already green, it is merged at once (`merged`); when GitHub answers that the repository does not allow auto-merge, this package's own merge watcher is started for the request (`watching`); any other refusal is `failed` with gh's line, never a wrong merge. GitHub's two answers are matched loosely, so a rephrase on GitHub's side lands in `failed`, said, rather than in a merge.
- **Landing by number** - a draft is marked ready first, since asking for the merge is the statement that its review happened; then the merge is armed exactly as `open --merge` arms it; a request that is not open is `not-open` with its state, since already merged is an answer, not an action; a request gh cannot read is `failed`; a view with no state reads as open.
