Adopts the branch a cloud session actually worked on: each settled web run is matched to the `claude/*` branch that grew out of its hand-off, and that branch — and its pull request — is recorded on the run.

## User Stories

- The user hands a task to Claude Code on the web and later finds the run's dashboard row carrying the branch the cloud session actually worked on, and its pull request.
- The user armed the run to open a pull request; when the session never opens one, the daemon opens the draft for it.

## Flows

- A web run hands the task to claude.ai and ends; the cloud session does the work on a branch of its own naming, never the branch the run was born on.
- The match is exact, never guessed: the hand-off pushed a commit unique to the run for the session to clone at, so the session's branch — and only it — descends from that commit. A run matching no branch (the session has not pushed, or never will) or more than one is simply asked again next pass, and a run past the window (two days) stops being asked about.
- What gets recorded, as one commit on the data branch (the dedicated branch the framework's own records live on) so every machine learns it: the branch, and the pull request the session opened for it. A run that was armed for a PR the session never opened gets its draft PR opened by the daemon — unless the branch carries nothing beyond the hand-off itself, or the session's pull requests could not be listed that pass.
- Adoption is not one-shot: a run recorded while its armed pull request was still missing is asked about again, and a later pass patches the pull request on once it exists.
- Adoptions and failures are said out loud; a run still waiting is not.

## Rationales

- Without adoption, every surface keyed to the run's branch — its dashboard row, its PR, CI watch, merge — would stare at an empty branch and say "nothing committed" while the work sat on origin.
- A failed PR listing withholds the daemon-opened draft because not knowing is never read as none: the cost of guessing wrong is a second pull request.
- Adoption is daemon-side by necessity: the branch does not exist yet when the run's own process ends — the cloud VM is still provisioning.
- A waiting run is not announced because waiting is its normal state.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
