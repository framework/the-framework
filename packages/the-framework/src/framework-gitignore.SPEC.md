The `.the-framework/.gitignore`: everything under a project's framework directory is transient on main.

## TLDR

- One file with one content, written whole at install: ignore it all, keep only the ignore file itself and the layout marker.
- Nothing else under the framework directory is committed on code branches any more — the lasting records (the session archives) live on the data branch — so the layout marker is the only re-inclusion.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
