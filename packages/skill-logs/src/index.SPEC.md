The package's main entry point: it gathers the runs directory's name, a run's card and diary (their fields, parsing and formatting), the branch's reads and writes with their seams, the command line and the executable's directory into one place for a caller to import. No business logic of its own. The name is also reachable on its own (`names`), for code that runs in a browser and must not pull in git.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
