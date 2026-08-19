Names the identity a finished agent's history is filed under, so the archive on the data branch is per user and two people on one repo never conflict.

## TLDR

- That history used to live only in untracked state, so an ordinary `git clean` erased every agent a project had ever run; keeping the archive in committed files — on the data branch, beside the queue and the tickets — is the fix.
- Each person's history files under a directory named after the git email they already commit with — nothing new to set up. A hostile or unusable value can never escape the archive path; it falls back to an "anonymous" directory rather than dropping history.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
