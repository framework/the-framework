What the tests cover, with gh scripted and a clock that moves one interval per wait:

- **Reading the checks** - check runs and classic statuses together; skipped passes; an in-progress run or a pending status is pending; a cancelled run is failing and named; no checks is `none`; a read gh refuses is pending.
- **Pending, then green** - merged once, by squash.
- **Nothing merged** - a red request, a request already merged, and a request still pending past the limit each end without a merge.
- **No checks** - the watch waits the grace out, then merges; a merge gh refuses is `failed` with gh's line.
