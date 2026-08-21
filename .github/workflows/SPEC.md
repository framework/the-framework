The repo's three GitHub Actions workflows — one is part of the product (the agent runner), two are repo plumbing (continuous integration and website deployment).

## User Stories

- The user runs an agent on a fresh GitHub Actions runner instead of their own machine.

## Flows

- When the user runs an agent on GitHub Actions instead of their own machine, the framework dispatches `framework-agent.yml` — one dispatch per agent turn, each on a fresh GitHub-hosted runner.
- `ci.yml` builds, typechecks, and tests every push and PR; `website-deploy.yml` publishes the-framework.ai whenever a change to the website lands on `main`.

## Rationales

- There is no release workflow: the package is unversioned and unpublished, so there is nothing to cut.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
