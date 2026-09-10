Runs an external command in a directory and answers with what it printed, under a time budget set per command, so no hung tool can hang the caller. What it reports on failure is the point: a command killed for outrunning its budget is reported as having timed out, and never as the tool refusing; and for a tool whose own error text is the useful part, that text is what the caller gets instead of a generic failure message.

## Context

**User story**: the user presses a button in the dashboard that pushes a branch or opens a pull request, or opens a page that lists pull requests. When GitHub's command line is not installed, is not logged in, or the repository has no default remote, the user reads that sentence — not "command failed" — and a network that never answers ends the wait rather than holding the page open forever.

**Business logic story**: this is what the `gh` command runs through (`dashboard/gh.ts`), which sets the budgets: a short one for the reads a page makes, a longer one for the actions a user pressed, which talk to the network. Git does not run through here; it has its own runner with a budget per subcommand, in the `skill-branches` package.

## Business logic — TL;DR

- **A command's output, or its failure** - the command runs in the given directory and answers with what it printed; a non-zero exit fails the call.
- **A budget per command** - each command is configured with how long it may take, and is killed past it. Such a failure says the command timed out and names the command and the budget it outran, rather than reading as a rejection by the tool. A command killed for printing more than can be held is not reported as a timeout.
- **The tool's own words, when they are the useful ones** - a command can be configured so a failure carries the tool's own error output, which is what the user reads; when the tool said nothing, the generic failure message is used instead.
