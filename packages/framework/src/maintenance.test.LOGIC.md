What the tests cover:

- **Assessing a project** - a first-seen project is baselined at its current commit with nothing reviewed retroactively; an unchanged project is skipped; commits added since the reviewed one mean a review carrying their count and the reviewed commit; a directory that is not a repository is an error; a reviewed commit git no longer knows means a re-review whose note says the history changed.
- **The state file** - an absent or malformed file reads as no prior review; a written state reads back exactly.
- **The plan over registered projects** - each project's assessment carries its registry id.
- **Running the sweep** - a baseline records the current commit without running anything; a skip runs nothing; a successful review records the commit; a failed review records nothing so it is retried next sweep; the tally counts each kind; a per-sweep cap on reviews stops after that many and leaves the rest pending.
- **The calendar-paced schedule** - a project nobody has swept is due immediately; a freshly swept project is left alone until the interval is up and is due exactly one interval later, so the weekly sweep does not drift; the interval is a week; a corrupted timestamp means due, not never.
- **Two schedules in one file** - recording the sweep time leaves the reviewed commit untouched, and the other way round; a partial record on a project with no file yet creates it.
