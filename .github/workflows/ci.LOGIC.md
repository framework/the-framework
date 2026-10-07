Verifies every change to the repository on GitHub-hosted runners: five jobs run side by side, each installs and builds the monorepo and then does one part of the verification (the type check, or one group of tests); a last job named "build" passes only when all five did, and its pass or fail is the check the merge rule on the main branch waits for. It pushes nothing and publishes nothing.

## Context

**User story**: a contributor opens a pull request and sees green or red checks on it before anyone reviews or merges; a red check names the part that failed.

**Problem**: a pull request opened from a branch of this same repository fires both a push event and a pull request event for the same commit. Run for both, it was verified twice; with one of the two skipped, the skipped run's "build" check read as green on the pull request before the real one existed, and a pull request set to merge on green merged unverified.

## Business logic — TL;DR

- **When it runs** - on every pull request, from a fork or not, and on every push to the main branch. A push to another branch runs nothing.
- **What it verifies** - the type check and every package's tests, as five jobs at the same time, each after its own install and build; a failing job does not stop the others.
- **The one check** - a job named "build" waits for the five and is green only when all of them are.
- **What it may do and produces** - the repository's default token permissions, no artifact, no push: its only product is the check's status.

## Business logic

### When it runs

#### Context

See `## Context`.

#### Business logic

The workflow, named "CI", runs on every pull request event and on every push to the main branch. A push to any other branch does not run it: the branch is verified once a pull request is opened for it, by the pull request's event, so a pull request has exactly one run for each commit.

### What it verifies

#### Context

**Business logic story**: the root `package.json` scripts define what "build", "typecheck" and "test" mean for the whole monorepo; this workflow only calls them.

#### Business logic

Five jobs run at the same time, each on its own latest Ubuntu runner with pnpm, Node 22 and pnpm's download cache. Each runs three commands at the repository root, each only if the previous one succeeded:

1. `pnpm install`: every package's dependencies.
2. `pnpm build`: every package of the monorepo that has a build, except the website package. Each package builds only itself, once. A package is built after the packages it depends on, as its `package.json` names them, and packages that do not depend on each other are built at the same time. OpenAgent's build compiles it, copies the browser extension into it (`packages/framework/scripts/copy-extension.mjs`) and builds the dashboard. Packages OpenAgent does not import, `agent-runner` and `agent-scheduler` among them, are built all the same: the project's hooks the daemon runs start them.
3. The job's own part, one of:
   - "typecheck": `pnpm typecheck`, every package that has a type check (each package's dashboard included), the website package too.
   - "framework browser tests": the OpenAgent dashboard's tests.
   - "framework node tests": OpenAgent's other tests.
   - "agent packages tests": the tests of `agent-runner`, `agent-scheduler` and `skill-orchestration`, one package at a time.
   - "other packages tests": the tests of every other package, one package at a time. This group is named by the packages it leaves out, so a new package's tests run here without a change to the workflow.

A job that fails does not stop the other four: one run says everything that is wrong.

**Problem**: the same commands in one job, one after the other, took about seven minutes on every pull request. The tests are split by job and not run side by side on one runner, because some tests are time-sensitive and fail under load.

### The one check

#### Context

**Problem**: the merge rule on the main branch waits for one check by its name, "build". Five jobs with five names would each need to be named in that rule, and a job added later would be forgotten there.

#### Business logic

A job named "build" runs after the five jobs, whatever their result, and passes only when all five passed. Until the five have ended it has no result, so a pull request set to merge on green waits for it.

### What it may do and produces

#### Context

**Problem**: a verification workflow that could write to the repository would turn a compromised dependency or test into a way to push code.

#### Business logic

The workflow declares no permissions, so it runs with the repository's default token permissions. It uploads no artifact, deploys nothing and pushes nothing: the only thing it produces is the pass or fail status of the check on the commit and on the pull request.
