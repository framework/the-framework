What the tests cover, with gh scripted and real git for the current branch:

- **Opening** - the request is opened on the current branch with the title and body given, its number read off the URL gh printed, the merge armed with `--merge`; a second open answers the open request as `existing` and opens no second one; `--branch` names another branch and its request is opened with an empty body when none is given.
- **Draft and refusals** - `--draft` opens a draft, dropped when the merge is armed; a detached working directory with no `--branch` is `no-branch`; a create gh refuses is `open-failed` with gh's line.
- **Arming where GitHub will not auto-merge** - an already green request is merged at once; a repository without auto-merge gets the watcher, started for that repository and number; any other refusal is `merge-failed` beside the open request.
- **Landing by number** - a draft is marked ready then armed; an open request is armed without the ready step; a merged request is `not-open` with its state; a view gh cannot answer is a failure; the number is read off a pull URL and off nothing else.
