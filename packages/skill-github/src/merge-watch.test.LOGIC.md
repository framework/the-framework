What the tests cover, with gh scripted and a clock that moves one interval per sleep:

- **One read** - runs and classic statuses; skipped and neutral pass, cancelled fails naming the check, an in-progress run or a pending status is pending, no checks is none, an unreadable read is pending.
- **The watch** - pending then green merges once by squash; a red request, a request closed meanwhile and a request pending past the limit merge nothing and end as `checks-failed`, `closed` and `timed-out`; a request with no checks is merged once the grace has passed and not before; a merge gh refuses is `failed` with gh's line.
