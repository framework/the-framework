GitHub's configuration of the repository, which consists only of its workflows: the check every change gets, the deploy of the marketing website, and the workflow that runs an agent's turn on a GitHub-hosted runner for The Framework's `github-actions` driver.

## Business logic — TL;DR

- **The workflows** (`workflows/`) - verifying every push and fork pull request, publishing the website from `main`, and running one turn of an agent on a runner when The Framework dispatches it; each is described in `workflows/LOGIC.md`.
