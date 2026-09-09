Where the queue lives, bound to the branch: `TODO_AGENTS.md` at the root of the `agent-data` branch of the project's repository, checked out at `.branches/agent-data` for a long-lived process.

## User story

- The user's caller shows the queue as other machines and cloud sessions push to it, without waiting for this machine to write something.

## Business logic — TL;DR

- **The seams every operation takes** - the file operations and the caller's write cycle, injected so every operation is testable off disk and git, with the persistent checkout's cycle as the default.
- **Bringing a caller's view up to date** - the branch and its checkout exist, the queue file is seeded, and the checkout converges with origin.

## Business logic

### The seams every operation takes

#### Business logic

Every operation in the package that changes the branch takes two things it does not own: plain file operations — read, write, delete, list — against whatever directory it is handed, and the caller's write cycle, which applies a change to a checkout of the branch, commits it and pushes it. A caller that leaves them out gets the defaults: the real filesystem, and the persistent checkout's serialized cycle on the `agent-data` branch. So the same operation reads the same way in a test with neither disk nor git and in production.

### Bringing a caller's view up to date

#### User story

See `## User story`.

#### Business logic

A long-lived process brings its view of the branch up to date in one step, which never throws and reports why it could not converge:

- The branch and its persistent checkout exist.
- The queue file is seeded on a branch born empty, so readers and people find a file rather than a mystery.
- The checkout converges with origin: reading what other machines and cloud sessions pushed, and pushing anything an earlier cycle left stranded.

A repository with no remote is reported as an error state rather than treated as a mode: the queue exists to be shared, and one nothing can reach is something the caller has to surface.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
