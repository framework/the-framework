Activating a repository for The Framework.

## Business logic — TL;DR

- **Activation is one commit** - `.the-framework/` is created with its ignore file, its layout marker and the materialized quality presets, and that lands as one commit holding only those files; whatever the user has uncommitted stays uncommitted.
- **The ignore file is the activation marker** - a repository that already carries `.the-framework/.gitignore` is already activated, and activating it again does nothing.
- **A folder that is not a repository becomes one** - The Framework treats git as the source of truth, so it initialises the repository for the user rather than refusing, and reports that it did.
- **Activation never crashes** - any git or filesystem failure comes back as a reported error the user can read.

## Business logic

### What activation puts in the repository

#### User story

The user points The Framework at a repository and expects it to be ready to run agents, with the framework's own bookkeeping visible in one commit they can read and revert.

#### Business logic

Activation creates the `.the-framework/` directory and fills it with three things:

- The ignore file, which keeps an agent's transient state out of the user's git history. It doubles as the marker that says this project is activated.
- The layout marker, recording the bookkeeping layout this build of The Framework writes. A build whose layout differs — an older or newer one — refuses to run in this repository rather than committing files in the wrong layout.
- The quality presets, written out as real files so that a queued quality follow-up points at a document the agent can actually open. They are kept out of git, so every activation regenerates them against the installed version of The Framework instead of letting a stale copy live on in the repository's history.

The user's own uncommitted work is left exactly as it is: the activation commit adds only The Framework's directory, so it contains nothing but The Framework's files, and nothing of the user's is ever committed on their behalf.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
