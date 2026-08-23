What the tests cover: giving a worktree its dependencies and hiding them from git.

- The scan finds the repo root's dependency tree and each workspace package's, and never descends into a dependency tree, the git directory, or the framework's own directory.
- Each tree is linked into the worktree at the same relative path, creating any missing parent directory; a tree already present in the worktree is left alone, and linking twice adds nothing.
- A filesystem that refuses to make a link is tolerated: the agent still starts.
- Against a real repo and a real worktree, the linked tree resolves — a dependency file is readable through it, and it is a link rather than a copy.
- Against real git: the repo's own ignore rule does not cover the links and leaves the worktree dirty, adding the exclusion makes the worktree clean, and adding it a second time does not duplicate the rule.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
