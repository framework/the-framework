What the tests cover: how each project is assessed, what a sweep actually runs, and how the two maintenance schedules are paced.

- A first-seen project is baselined at its current commit with nothing reviewed retroactively; an unchanged project is skipped; a project with new commits is reviewed and the count of new commits is reported.
- A path that is not a git repository is reported as an error rather than failing the sweep, and a project whose recorded commit no longer exists because history was rewritten is reviewed again, saying why.
- Review state survives a write-and-read cycle, and an absent or malformed state file reads as "never reviewed" instead of failing.
- Each assessed project carries its registry identity through the plan.
- A sweep runs nothing for baselined or skipped projects, records the current commit for a baseline and for a successful review, and deliberately does not record a failed review so the next sweep retries it. The tally counts reviewed, baselined, skipped and failed projects.
- A sweep capped at a number of reviews runs exactly that many and reports the rest as pending.
- A project nobody has ever swept is due a codebase-wide pass immediately; a freshly swept one is left alone until a full week has passed, and exactly one week later counts as due so a weekly schedule does not drift later every week. The interval is a week.
- A sweep timestamp that cannot be read counts as due, rather than silently dropping the project out of the schedule forever.
- Recording progress on one schedule never resets the other, in either direction, and recording either one works when the project has no state file yet.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
