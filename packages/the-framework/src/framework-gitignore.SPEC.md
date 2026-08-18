The `.the-framework/.gitignore`: what a project commits out of its framework directory, and what stays transient.

## TLDR

- An agent's live state stays out of git; the agent archive is committed.
- One file with one content, written whole at install, naming no user.

## Flows

- Everything under the framework directory is ignored, and then the archive is re-included: the directories on the way down first, since git never descends into an ignored one, and the files under them after.
- The archive is re-included by a glob covering every user, so someone who has never run an agent is already covered.
- Only the name the archive directory has now is re-included.
- Install writes the whole file. A repo activated before the archive existed gets the missing rules appended; a repo that already has them is left alone.

## Rationales

- The archive is the one thing under here that is committed, because `git clean -fdx` is an ordinary thing to do to a repo and it used to delete every agent a project had ever run.
- Naming each user meant everyone who ever ran an agent appended their own lines to a tracked file: their checkout went dirty, the next safety commit swept the edit into a branch, and two machines doing it near each other conflicted.
- The name the directory was renamed away from is not carried as a second rule, because this file is written into everyone's repo and should say what is true now rather than list every name that directory has ever had.
- It grew a rule per record while there were several, each added lazily by whichever feature needed it and each with its own "is this a file we wrote" check. With one record left, the only question is whether the file is already there.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
