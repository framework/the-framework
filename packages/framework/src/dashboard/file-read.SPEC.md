Reads one file out of a checkout for the file tree's hover card, and owns the guard every client-supplied file path must pass — the diff read and the contents preview both go through it.

The guard admits only a plain repo-relative path: no traversal, no absolute or drive-letter path, no leading dash (git would read it as a flag), no NUL, no empty segments, and never any `.git` segment — a repo's `.git` holds config and credentials, a nested repo's too. The confined read then resolves the path inside the checkout and refuses anything whose real on-disk location falls outside it, resolving symlinks on both sides: a repo-relative symlink pointing out of the checkout passes any textual check while the read would leave the repo, so only real resolution makes the containment real.

On top sits the unchanged-file preview: the file's text capped at a 500-line preview limit and marked when cut, binary files flagged instead of rendered, and read from the resolved checkout so an agent's hover shows its own worktree's copy rather than the project root's. Anything unsafe, outside the checkout, or unreadable yields nothing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
