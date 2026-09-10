What the tests cover, by running a real command:

- **Outrunning the budget** - a command that keeps running past the time it was allowed is killed and the failure says it timed out, naming the budget in milliseconds, rather than reading as a generic failure.
- **A command that simply failed** - a command that exits with a failure code inside its budget is reported as a failure, never as a timeout.
- **What a timeout says** - the timeout failure spells out the command with its arguments and the budget it outran ("git push --set-upstream origin branch timed out after 120000ms"), so the reason a push or a pull request did not happen is readable.
