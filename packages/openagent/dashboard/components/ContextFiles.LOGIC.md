The list of files picked into the launcher's [1] Context [2]: one row per file with its repository-relative path and a remove cross, inside the "Context" picker's "Files" group. With no files picked the list is absent.

## Context

**User story**: the user `#`-mentioned a file and then cleared the prompt, or clicked a file in the right rail's file tree: the file is still picked, and this list is where the user sees it and takes it out.

## Glossary

[1] launcher: the Start form on a project's own page.
[2] Context: the set of paths the user picked to focus an agent on: other registered projects, by their absolute path, and files of the current project, by their path relative to the repository's root. The agent can still reach everything; the Context only says where to look.

## Business logic — TL;DR

- **One row per picked file** - its repository-relative path, shortened when too long with the full path on hover.
- **Removing a file** - the remove cross, named "Remove <path> from context" with the tooltip "Remove <path>", takes the file out of the Context, which also unticks it in the file tree; it is disabled while the launcher is busy.
- **Nothing picked** - no list at all.

## Business logic

### The list

#### Context

A file reaches the Context through a `#` mention in the prompt or through the right rail's file tree, and both add the same path, so this one list shows both.

#### Business logic

Each picked file is one row: the remove cross, then the path. The cross is named "Remove <path> from context", its tooltip reads "Remove <path>", and pressing it removes that path from the Context; the file tree reads the same Context, so the file is unticked there too. The cross is disabled while the launcher is busy. With no files picked nothing is rendered.
