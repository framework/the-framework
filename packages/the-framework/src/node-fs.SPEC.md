The filesystem conventions everything in The Framework follows when it touches disk: creating a directory also creates its parents, listing a directory that does not exist yields nothing rather than failing, and asking whether a path is a file or a directory answers "no" for anything that cannot be inspected — so a missing or unreadable path is never an error anyone has to handle. Reading a file that is absent does fail, replacing one file with another happens in a single step so a reader never sees a half-written state, and a file's permission bits can be set.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
