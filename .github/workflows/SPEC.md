Everything the repository has GitHub do on its own: guarding the product's own code, hosting agents that run away from the user's machine, and publishing the product website.

## Business logic — TL;DR

- **CI guards every change** - each push and each pull request builds the product, type-checks it, and runs its test suite; a pull request opened from a branch of this same repository is checked once rather than twice.
- **A workflow hosts agents that run on GitHub** - the workflow behind the `actions` run target carries out one turn of one agent on a disposable runner, pushes that turn's work to a branch so the next turn can continue from it, and hands the turn's transcript back to the daemon; it is described in its own spec.
- **The website is published from the default branch** - changes to the product website land on https://the-framework.ai automatically; it is described in its own spec.

## Business logic

### CI guards every change

#### User story

The user's agents open pull requests unattended, and the daemon merges them once their checks pass. Those checks are what stands between an unattended agent and the default branch.

#### Business logic

Every push and every pull request builds the product, checks its types, and runs its test suite, on the Node.js version the product supports. All three must succeed for the change to be considered green.

#### Rationale

A pull request from a branch of this same repository would otherwise be checked twice — once for the push that created the branch, once for the pull request itself — so that duplicate is suppressed, leaving one result per change and no wasted quota.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
