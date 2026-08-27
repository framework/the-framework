The terminal surface for an agent's event stream: renders each framework event from the event log as one human-readable line, the CLI's counterpart to the dashboard's projections of the same stream. Pure formatting, kept apart from the event contract itself.

## Business logic — TL;DR

- **One event, one line** - every event kind has a wording: session start, branch, ticket being implemented, preview and browser URLs, gates (a question with its options, the recommendation or checked defaults marked), picks, driver output, usage, handoff, errors, and the end state (finished / stopped / failed).
- **Usage never reads as free** - a turn total with no reported price prints the token counts with "no price reported" rather than a `$0.0000` that would read as a free agent; with a price, the spend and turn count print.
- **Handoff outcomes are always said** - the armed line states consequences up front ("push the branch, open a PR, and merge it" — unattended merging is the one consequence a reader cannot be left to infer), and after a handoff every merge outcome is spelled out (armed, watched, merged, withheld with the reason, failed): after "auto-merge was on", silence about the merge would read as "it merged".
- **Reasons in the reader's terms** - skip and withhold codes (handoff skipped, merge withheld, post-merge cleanup skipped) are worded as reasons a person understands ("the session never signalled ready-for-merge", "this repo has no remote to push to"), not as internal codes; the merge-withheld wording is shared with the CLI's own output so the two surfaces cannot drift.
- **Quota is quiet on the happy path** - a driver rate-limit line only stands out when the quota is exhausted or running low.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
