What the tests cover, against a real repository with an origin and an `agent-data` branch:

- **The marker** - a running card with the prompt as its intent and the tool's mark (the host and the pid) read back as written, pushed to origin as `logs: record run <id>`, that the `logs` skill finds like any run with an empty diary.
- **The record at the end** - written over the marker, same id, with the status, the pull request, the diary and the mark kept; a withdrawn marker is gone from the branch, and only the recorded run is listed.
