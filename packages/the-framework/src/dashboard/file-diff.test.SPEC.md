What the tests cover:

- One file's diff: a modified file yields only the hunks (git's preamble dropped), with added/removed counted and the file headers not counted as changes; a file with no diff yields nothing rather than an empty card; a binary change is flagged instead of dumped; a long patch is cut at the preview limit and marked; a repo with no commits falls back to the working-tree diff; an untracked file renders as all-added from its contents without git being asked, and an untracked file reached through a symlink pointing out of the repo is refused.
- The path guard: only plain repo-relative paths pass — traversal, absolute and drive-letter paths, a leading dash (which git would read as a flag), `.git` segments, empty segments, and NUL bytes are all rejected — and an unsafe path is refused before any git call or read.
- The Changes list: every changed file is counted from a single numstat call rather than a diff each; an untracked file, absent from any diff, is counted from disk; the list is sorted by path so a live agent's edits do not reshuffle it; an unsafe path is dropped rather than passed to git; a clean checkout yields an empty list without asking git anything.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
