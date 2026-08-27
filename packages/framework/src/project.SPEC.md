Answers the read-only questions The Framework asks about a project's repository — is it activated, and what files does it contain.

## Business logic — TL;DR

- **Activation is proven by one marker** - a project counts as activated for The Framework only when it carries the `.the-framework/.gitignore` file that installation writes.
- **The repo's file list is what git sees** - the crawl lists tracked and untracked files, honoring the repo's ignore rules, as sorted repo-relative paths.
- **Reading never fails** - a missing git or any git error reads as an empty file list, rather than raising an error.

## Business logic

### Activation is proven by one marker

#### User story

The user registers a repo with The Framework; before the framework may work in it, the repo has to be installed. The dashboard must be able to tell an installed project from a registered-but-not-yet-installed one.

#### Business logic

A project is activated exactly when the `.the-framework/.gitignore` file exists. This is the same marker installation itself checks before deciding it has nothing to do.

#### Rationale

The marker is the ignore file rather than the `.the-framework/` directory, because some other tool — or a half-finished attempt — can leave that directory behind. Keying on the ignore file means a project can never read as activated while it still lacks the very file that keeps framework state off its branches.

### The repo's file list is what git sees

#### User story

The dashboard's file sidebars, and anything else that needs to know what a project contains, want the project as the user perceives it: the files git tracks plus the new ones they have not committed yet, and none of the build output and dependencies the repo deliberately ignores.

#### Business logic

The crawl asks git for both tracked and untracked files while honoring the repo's ignore rules, and reports the result as repo-relative paths, de-duplicated and sorted. A project that is not a repo, or where git fails for any reason, reports no files.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
