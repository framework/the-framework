The `.the-framework/.gitignore`: everything under a project's framework directory is transient on main.

## Flows

- One file with one content, written whole at install: ignore it all, keep only the ignore file itself and the layout marker.

## Rationales

- Nothing else under the framework directory belongs on code branches — the lasting records (the session archives) live on the data branch — so the layout marker is the only re-inclusion.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
