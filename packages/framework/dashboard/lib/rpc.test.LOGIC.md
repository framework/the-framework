What the tests cover:

- **A left-out argument is not sent** - a call whose last optional argument is left out sends only the arguments before it, so the daemon sees it absent rather than `null`.
- **A given argument is sent** - the same call with that argument given sends it.
