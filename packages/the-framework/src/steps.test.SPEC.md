What the tests cover: the workspace-emptiness check calls an empty directory, a directory holding only noise (lockfiles, dotfiles, node_modules), and a missing directory empty, and a directory with a real source file not empty; the greenfield build prompt names the intent, frames an end-to-end build, and warns the workspace may be empty; the existing-codebase prompt names the work and the existing codebase and nothing else — none of the retired behavior rules, no scope ask, and no claim the workspace might be empty; the scaffold retry prompt is the hard from-scratch directive and says an empty directory is expected rather than a reason to refuse.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
