What the tests cover, against a real repository with an origin and an `agent-data` branch:

- **The marker** - a running card with the tool's mark, pushed to origin as `logs: record run <id>`, that the `logs` skill finds like any run with an empty diary.
- **In flight** - the running cards of one command count whatever the machine; another command's and a running card without the tool's mark do not.
- **The record at the end** - written over the marker, same id, with the status, the pull request and the mark kept, and the run no longer in flight; a withdrawn marker is gone from the branch.
