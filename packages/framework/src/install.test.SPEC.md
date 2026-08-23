What the tests cover: activating a repository, and finding the repositories inside a folder.

- Activating a clean repository writes the `.the-framework/.gitignore` marker and produces exactly one install commit.
- The quality presets are written out during activation, so a queued quality follow-up points at a document that really exists.
- The seeded ignore file ignores everything transient under `.the-framework/` and un-ignores only itself and the layout marker — the lasting records live on the data branch, so nothing else is kept.
- The layout marker is written and is tracked, which is what lets a build with a different layout refuse to run in the repository.
- A repository with uncommitted work commits that work first, under its own message, and only then commits the activation.
- An already-activated repository is left completely untouched and reported as already activated.
- A folder that is not a git repository is initialised first and reported as such, and still gets a single install commit.
- A git failure anywhere in activation is reported as a failed outcome carrying the reason, never as a crash.
- Repository discovery keeps only the child folders that are repository roots in their own right, sorted: a folder sitting inside an outer repository and a folder that is no repository at all are both left out; an empty or missing folder yields nothing without consulting git.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
