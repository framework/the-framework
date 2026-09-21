Merges one pull request once its checks pass, for a repository that does not allow GitHub's auto-merge: a process of this package's own, started detached by `open --merge` or `merge <number>` (`merge.ts`), that reads the request every minute and merges it by squash when it is green.

## Context

**User story**: an agent opens its pull request with `--merge` in a repository whose settings do not allow auto-merge; the request lands once its checks pass, the same as where auto-merge is on, and a red request stays open for a person.

**Problem**: the agent's session ends right after it opens the request, and nothing else runs for it. The watcher keeps nothing but the request's number: the request on GitHub is the whole state, so a watcher that dies (a reboot) leaves an open request a person can merge, never a wrong merge.

## Glossary

[1] checks: the request's GitHub Actions check runs and classic commit statuses, as GitHub rolls them up for the request.

## Business logic — TL;DR

- **One read** - the request's state and its checks [1]: `passing` when every check concluded and none failed (skipped and neutral count as passing), `failing` when any concluded check failed, was cancelled or timed out, `pending` while any still runs, `none` when no check is reported; a read gh cannot answer counts as `pending`, so an unreadable status never merges.
- **The watch** - a request no longer open ends the watch as `closed`; `failing` ends it as `checks-failed`, naming the failed checks; `passing` merges it by squash (`merged`, or `failed` with gh's line); `none` counts as green once two minutes have passed since the watch began, the time checks take to attach after a push; anything else waits a minute and reads again, up to six hours (`timed-out`).
- **Its own process** - started detached from the project's root as `github watch <number>`, its output appended to `.branches/merge-on-green/<number>.log`; it outlives the agent that opened the request.
