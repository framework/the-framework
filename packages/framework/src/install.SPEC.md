Activating a repository for The Framework, and finding the repositories a folder contains so the user can be offered them.

## Business logic — TL;DR

- **Activation is one commit** - any work already uncommitted in the repository is committed first, then `.the-framework/` is created with its ignore file, its layout marker and the materialized quality presets, and that lands as its own clean commit.
- **The ignore file is the activation marker** - a repository that already carries `.the-framework/.gitignore` is already activated, and activating it again does nothing.
- **A folder that is not a repository becomes one** - The Framework treats git as the source of truth, so it initialises the repository for the user rather than refusing, and reports that it did.
- **Activation never crashes** - any git or filesystem failure comes back as a reported error the user can read.
- **Repository discovery** - the immediate child folders of a directory that are git repository roots in their own right are listed, sorted; a folder that merely sits inside some outer repository is not one, and anything that is not a repository at all is passed over silently.

## Business logic

### What activation puts in the repository

#### User story

The user points The Framework at a repository and expects it to be ready to run agents, with the framework's own bookkeeping visible in one commit they can read and revert.

#### Business logic

Activation creates the `.the-framework/` directory and fills it with three things:

- The ignore file, which keeps an agent's transient state out of the user's git history. It doubles as the marker that says this project is activated.
- The layout marker, recording the bookkeeping layout this build of The Framework writes. A build whose layout differs — an older or newer one — refuses to run in this repository rather than committing files in the wrong layout.
- The quality presets, written out as real files so that a queued quality follow-up points at a document the agent can actually open. They are kept out of git, so every activation regenerates them against the installed version of The Framework instead of letting a stale copy live on in the repository's history.

The user's own uncommitted work is committed before any of this, under its own message, so the activation commit contains only The Framework's files.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
