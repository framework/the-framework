The terminal surface for the run's event stream: `formatFrameworkEvent()` renders one `FrameworkEvent` as one human-readable line — the CLI counterpart to the dashboard's `run-view.ts` projections, kept out of `events.ts` so the event contract stays a plain, browser-safe data module.

## TLDR

- One exhaustive `switch` over the event union (session, usage, choice, handoff, driver, bootstrap, end, …), plus sub-formatters for driver and bootstrap events.
- Skip reasons are translated into the reader's terms, not the guard's codes (#835): `skipReason` for on-before-mergeable, `handoffSkipReason` for the #1102 handoff.
- `handoff-armed` is said as what will happen ("push the branch and open a draft PR"), not as two flags — the line is read once, at a glance. A merge-armed run says "push the branch, open a PR, and merge it" (#1382): its PR is opened ready and lands unattended, so the line must own both, never "draft PR".
- Usage with no reported price prints token counts and "no price reported" rather than a `$0.0000` that would read as free (#540).
- Rate limits are quiet on the happy path: only `rejected`/`allowed_warning` earn alarm markers.
- `truncate()` flattens whitespace and caps prompt/text lines (140/100 chars).
