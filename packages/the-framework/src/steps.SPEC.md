The prompts a build agent opens with, and the one check that decides between them.

## Flows

- The framing states the one thing the agent cannot infer: build from scratch in an empty workspace, or work within the codebase that already exists — an existing project is extended, never re-scaffolded.
- A workspace holding no source the agent could have written counts as empty; lockfiles, dotfiles, and dependency or output directories do not.
- A third prompt exists for the case where a build left the workspace empty anyway: a hard "create it from scratch, an empty directory is expected" directive.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
