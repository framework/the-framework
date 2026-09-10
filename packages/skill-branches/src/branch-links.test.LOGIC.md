What the tests cover, the last one against a real git repository:

- **A checkout on its birth branch** - gets no link: its directory already carries the branch's name.
- **A renamed branch** - gets a link named as the new branch pointing at the checkout's directory, and the link for the old name is dropped in the same pass.
- **A reclaimed checkout** - loses its link; a detached checkout and a checkout on a slashed branch (`feature/old-name`) never get one.
- **Only the package's own links are touched** - a file of the user's at a wanted name stays and nothing is created over it; a link pointing anywhere but an agent branch name is never removed.
- **A directory git does not know as a worktree** - a directory left under `.branches/` gets no link, in particular no link named after the user's own branch, while a real rename beside it is linked.
