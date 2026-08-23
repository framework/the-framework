What the tests cover: a checkout still on its birth branch gets no link, since the directory already carries the name; a renamed branch gets a sibling link and the stale name is dropped in the same pass; a reclaimed checkout loses its link, and detached or legacy slash-named branches never get one; user files and foreign symlinks are never removed, and nothing is created over a user's entry that occupies a wanted name; the repo-root `branches` shortcut is created once, relative, and hidden from git with the exclude pair — while an occupied path is left alone and nothing is excluded on the user's behalf; the recurring pass visits every registered project, and a stopped pass does nothing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
