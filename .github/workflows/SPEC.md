The repo's GitHub Actions workflows: continuous integration, the dispatchable agent runner, and website deployment.

## TLDR

- `framework-agent.yml` is the only workflow that is part of the product runtime — the daemon dispatches it to run agent turns on cloud runners; the rest is repo plumbing.
- `ci.yml` builds, typechecks, and tests every push and PR; `website-deploy.yml` publishes the-framework.ai. There is no release workflow: the package is unversioned and unpublished, so there is nothing to cut.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
