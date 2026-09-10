Verifies every change to the repository on a GitHub-hosted runner: one job installs the monorepo, builds it, type-checks it and runs every package's tests, in that order, and its pass or fail is the "CI" check GitHub shows on the commit and on the pull request. It pushes nothing and publishes nothing.

## Context

**User story**: a contributor pushes a branch or opens a pull request and sees a green or red "CI" check on it before anyone reviews or merges; a red check names the step that failed.

**Problem**: a pull request opened from a branch of this same repository fires both a push event and a pull request event for the same commit, which would verify it twice for no information; a pull request from a fork fires no push event here, so it needs the pull request event.

## Business logic — TL;DR

- **When it runs** - on every push to any branch, and on a pull request only when the pull request comes from a fork.
- **What it verifies** - install, build, type check and every package's tests, stopping at the first failing step.
- **What it may do and produces** - the repository's default token permissions, no artifact, no push: its only product is the check's status.

## Business logic

### When it runs

#### Context

See `## Context`.

#### Business logic

The workflow, named "CI", runs on every push to any branch and on every pull request event, with one exclusion: a pull request event whose head branch lives in this same repository is skipped, because the push of that branch already runs the workflow. A pull request from a fork is not skipped, since a push to a fork never reaches this repository's workflows.

### What it verifies

#### Context

**Business logic story**: the root `package.json` scripts define what "build", "typecheck" and "test" mean for the whole monorepo; this workflow only calls them.

#### Business logic

One job on the latest Ubuntu runner, with pnpm, Node 22 and pnpm's download cache, runs four commands at the repository root, each only if the previous one succeeded:

1. `pnpm install`: every package's dependencies.
2. `pnpm build`: the framework package's build, which builds the four skill packages and the `agent-driver` package, generates the prompts module from the prompt markdown (the rule in `packages/framework/scripts/gen-prompts.mjs`), compiles the framework and builds the dashboard.
3. `pnpm typecheck`: the framework package, its dashboard, and the website package.
4. `pnpm test`: the tests of every package, in order: `agent-data`, `skill-branches`, `skill-tickets`, `skill-queue`, `skill-logs`, `agent-driver`, then `framework`.

The first failing command fails the job; the later commands do not run.

### What it may do and produces

#### Context

**Problem**: a verification workflow that could write to the repository would turn a compromised dependency or test into a way to push code.

#### Business logic

The workflow declares no permissions, so it runs with the repository's default token permissions. It uploads no artifact, deploys nothing and pushes nothing: the only thing it produces is the pass or fail status of the check on the commit and on the pull request.
