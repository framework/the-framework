The package's main entry point: it gathers the two names, the git runner, the exclude rule and the branch used as a file store into one place for a caller to import. No business logic of its own. The two names are also reachable on their own (`names`), for code that runs in a browser and must not pull in git.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
