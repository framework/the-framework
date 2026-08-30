The package's main entry point: it gathers the naming conventions, the ticket reader, the claims, the queue, the holder, the branch's paths and sync, the command line and the executable's directory into one place for a caller to import. No business logic of its own. The naming conventions are also reachable on their own (`names`), for code that runs in a browser and must not pull in git.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
