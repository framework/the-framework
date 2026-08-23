Verifies every change to the repository. On every push and every pull request, one job installs dependencies (pnpm, Node 22), builds the `framework` package, typechecks every package (the `framework` package and the website), and runs the full test suite.

A pull request whose branch lives in this same repository is skipped: its push already ran the job, so the pull-request trigger only adds coverage for pull requests from forks.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
