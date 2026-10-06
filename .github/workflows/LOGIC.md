The repository's three GitHub workflows: the check every pull request and every push to the main branch gets, the deploy that keeps the marketing website live, and the workflow that runs one turn [2] of an agent [1] on a GitHub-hosted runner for `@openagt/agent-driver-github-actions`'s `github-actions` driver [3]. The first two serve this repository's own development; the third is a piece of the product, carried by any repository that wants its agents to run on GitHub's runners, this one included.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[3] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.

## Business logic — TL;DR

- **Verifying every change** (`ci.yml`) - on every pull request and on every push to the main branch, five jobs side by side each install and build the monorepo and then run one part: the type check, or one group of the packages' tests. A last job named "build" is green only when all five are: it is the check the merge rule on the main branch waits for.
- **Publishing the website** (`website-deploy.yml`) - on a push to `main` that touches the website package, the site is built and replaces the whole `gh-pages` branch as one commit, carrying the custom domain `the-framework.ai`.
- **Running an agent's turn on a runner** (`openagent-agent.yml`) - only when dispatched by the driver [3], with a prompt and a correlation id: the run checks the repository out, runs Claude Code on the prompt with every permission granted on the user's subscription token, pushes whatever the coding agent left to the branch the driver named, and uploads the transcript and that branch name as one artifact keyed by the correlation id, even when the coding agent failed.
