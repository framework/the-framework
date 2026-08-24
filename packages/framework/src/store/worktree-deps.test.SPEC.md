What the tests cover: giving a worktree its dependencies.

- The scan finds the repo root's dependency tree and each workspace package's, and never descends into a dependency tree, the git directory, or the framework's own directory.
- Each tree is mirrored into the worktree at the same relative path as a real directory holding one link per entry, creating any missing parent directory; a tree already present in the worktree is left alone, and mirroring twice adds nothing.
- The package manager's private state — every dot-entry but the executables directory — is not linked.
- A filesystem that refuses to make a link, or the directory, is tolerated: the agent still starts.
- Against a real repo and a real worktree with a pnpm-shaped tree (a package entry that is a relative link into the store), the mirrored tree resolves — a dependency file is readable through the chain, the worktree's directory is real and holds only the package entries — and replacing an entry in the worktree, as an install would, leaves the parent's tree and its link exactly as they were.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
