The project's pull requests as one read, in one shape, for every caller: an agent listing them, the dashboard's server reading a run's request, the Human Queue's open requests or the sweep's view of a branch, the scheduler reading a run's request into its record.

## Business logic — TL;DR

- **One gh listing per query** - `gh pr list` with the state asked for (`open`, `merged` or `all`, `all` when none is named), the head branch when one is named, at most 50 requests, and the fields the shape needs.
- **The shape** - `number`, `url`, `state` (`open`, `merged` or `closed`: gh's own states lowercased, anything unknown reading as `closed`), `title`, `draft`, `branch` (the head branch's name), `head` (the head commit), `createdAt`, and `mergedAt` and `mergeCommit` (the commit it landed as on the base branch) only when the request merged; a row without a number and a url is no request.
- **Since** - `--since <time>` keeps the requests created at or after it; when only merged ones were asked for, the ones merged at or after it.
- **None is not could-not-tell** - a listing gh cannot answer (not installed, not logged in, no remote) throws rather than answering an empty list, so a caller about to open a request, or keeping a baseline of what it announced, never takes a failure for "none"; the one exception is the question "does this branch have an open request", asked before opening one, which reads a failure as none and lets `gh pr create` give its own refusal.
