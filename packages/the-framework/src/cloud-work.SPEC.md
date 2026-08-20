Adopts the branch a cloud session actually worked on: each settled web run is matched to the `claude/*` branch that grew out of its hand-off, and that branch — and its pull request — is recorded on the run.

## TLDR

- A web run hands the task to claude.ai and ends; the cloud session does the work on a branch of its own naming, never the branch the run was born on. Without adoption, every surface keyed to the run's branch — its dashboard row, its PR, CI watch, merge — stared at an empty branch and said "nothing committed" while the work sat on origin.
- The match is exact, never guessed: the hand-off pushed a commit unique to the run for the session to clone at, so the session's branch — and only it — descends from that commit. A run matching no branch (the session has not pushed, or never will) or more than one is simply asked again next pass, and a run past the window (two days) stops being asked about.
- What gets recorded, as one commit on the data branch so every machine learns it: the branch, and the pull request the session opened for it. A run that was armed for a PR the session never opened gets its draft PR opened by the daemon — the armed handoff finally resolving against the facts — unless the branch carries nothing beyond the hand-off itself, or the session's pull requests could not be listed that pass: not knowing is never read as none, since the cost would be a second pull request.
- Daemon-side by necessity: the branch does not exist yet when the run's own process ends — the cloud VM is still provisioning — so a later pass patches the run's record, the same way a late-opened PR already is.
- Adoptions and failures are said out loud; a run still waiting is not, because waiting is its normal state.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
