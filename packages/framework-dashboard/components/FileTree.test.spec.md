Tests for `FileTree.tsx` — covers worktree-scoped status reads (#815): the project home reads the project checkout, a session reads its own worktree, switching sessions re-reads, and a changed file gets its status dot.

## Facts

- #815/#738 regression context: the action bar above the tree resolves the worktree since #738, so reading the project root here put a clean branch next to another checkout's M/U/D dots.
