The repo's five GitHub Actions workflows: continuous integration, the dispatchable agent runner, prompt-drift checking, releases, and website deployment.

## TLDR

- `framework-agent.yml` is the only workflow that is part of the product runtime — the daemon dispatches it to run agent turns on cloud runners; the rest is repo plumbing.
- `ci.yml` builds, typechecks, and tests every push and PR; `release.yml` publishes the packages; `website-deploy.yml` publishes the-framework.ai; `prompt-drift.yml` checks that the repo's prompt still matches its source of truth.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
