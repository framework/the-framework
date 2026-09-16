What the tests cover, one run end to end on a real repository with the coding agent faked:

- **A run that commits** - the marker, the checkout under `.branches/` for the run's id, the live log mid-run (`running`, the pid, the host, the intent, the birth branch, the mark), the branch the agent renamed and the pull request read back, the cost, the record (`done`, branch, cost, model, driver, mark) with a diary of session, intent, branch, what the agent said, its result, session id, cost, branch and end, and the checkout reclaimed once the branch is on origin.
- **A run that commits nothing** - `done`, no pull request, the checkout and its empty branch gone.
- **A driver that throws** - `failed` with the error as the detail, on the outcome, the card and the diary's last line.
- **A signal mid-run** - SIGINT to the run's process while the agent works: the session is aborted, the outcome, the card and the diary's last line say `stopped` with the detail `stopped by a signal to its process`, what the agent said before is kept, and the checkout is reclaimed.
- **The tick's run** - a given id and "already marked" writes no second marker and still records the run; a dirty tree keeps the checkout with the reason `dirty`.
