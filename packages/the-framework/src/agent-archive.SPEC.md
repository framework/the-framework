Names the identity a finished agent's history is filed under, so the archive on the data branch (`tf-data`, where the framework commits its own records) is per user and two people on one repo never conflict.

## Flows

- Each person's history files under a directory named after the git email they already commit with — nothing new to set up. An email that cannot become a safe directory name — hostile, empty, or unreadable — files under an "anonymous" directory instead: history is never dropped, and no configured value can ever climb out of the archive path.

## Rationales

- The archive lives in committed files — on the data branch, beside the queue and the tickets — because untracked state does not survive an ordinary `git clean`, which erases every agent a project has ever run.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
