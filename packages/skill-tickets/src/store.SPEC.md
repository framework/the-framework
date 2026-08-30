Where the tickets live, bound to the branch: the `tickets` branch of the project's repository, checked out at `.branches/tickets` for a long-lived process, with a `tickets` link at the repository root so the roadmap is one listing away for a person.

## User story

- The user opens the project's directory and finds the tickets there, without any of them being on a code branch or in any commit of the user's own work.
- The user's caller shows the roadmap as other machines and cloud sessions push to it, without waiting for this machine to write something.

## Business logic — TL;DR

- **The paths the branch has under a project** - the persistent checkout, and the `tickets/` folder inside it.
- **The seams every operation takes** - the file operations and the caller's write cycle, injected so every operation is testable off disk and git, with the persistent checkout's cycle as the default.
- **Bringing a caller's view up to date** - the branch and its checkout exist, the queue file is seeded, the root link is made, and the checkout converges with origin.
- **The root link is made only over nothing, and hidden from git at once** - a pair of exclude rules keeps the link out of every code branch while the branch's own `tickets/` folder keeps committing.

## Business logic

### The paths the branch has under a project

#### Business logic

Under a project, the branch's persistent checkout is `.branches/tickets`, and the tickets themselves are in the `tickets/` folder inside it. Both are derived from the project's root directory, so a caller addresses them without being configured.

### The seams every operation takes

#### Business logic

Every operation in the package that changes the branch takes two things it does not own: plain file operations — read, write, delete, list — against whatever directory it is handed, and the caller's write cycle, which applies a change to a checkout of the branch, commits it and pushes it. A caller that leaves them out gets the defaults: the real filesystem, and the persistent checkout's serialized cycle on the `tickets` branch. So the same operation reads the same way in a test with neither disk nor git and in production.

### Bringing a caller's view up to date

#### User story

See `## User story`.

#### Business logic

A long-lived process brings its view of the branch up to date in one step, which never throws and reports why it could not converge:

- The branch and its persistent checkout exist.
- The queue file is seeded on a branch born empty, so readers and people find a file rather than a mystery.
- The repository root links `tickets` into the checkout.
- The checkout converges with origin: reading what other machines and cloud sessions pushed, and pushing anything an earlier cycle left stranded.

A repository with no remote is reported as an error state rather than treated as a mode: the tickets exist to be shared, and one nothing can reach is something the caller has to surface.

### The root link is made only over nothing, and hidden from git at once

#### User story

- The user browses the project's own directory and sees the tickets; the user's own `tickets/` folder, if there is one, is never touched.

#### Business logic

The root link is created only where nothing sits at that path: a real `tickets/` folder or a file of the user's own is theirs, and is left exactly as it is — visible to git, not excluded.

A link that is made is hidden from git the moment it is made, because an uncommitted entry at the repository root would ride any sweeping "add everything" onto a code branch. Hiding it takes a *pair* of rules, because the repository's exclude file speaks for every checkout at once — the branch's persistent checkout included, whose own root holds the real `tickets/` folder the branch exists to carry. One rule hides root entries of that name; the second re-includes directories, which a link never matches. So the link stays hidden while the checkout's folder keeps committing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
