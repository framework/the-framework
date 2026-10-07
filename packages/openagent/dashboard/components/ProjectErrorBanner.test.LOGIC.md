What the tests cover:

- **No errors, no banner** - a project with no error list, or an empty one, renders nothing and no alert.
- **A data-sync error reads as an alert** - the alert carries the headline "Not syncing with the remote", the failing command's own words ("Permission denied (publickey)"), and how long it has been going on ("since 3h ago").
