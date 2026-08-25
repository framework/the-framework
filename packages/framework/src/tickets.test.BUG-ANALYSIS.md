# Bug analysis: packages/framework/src/tickets.test.ts

## Business logic (high-level)

Pure-function tests for `tickets.ts`, plus three tests that assert the *shipped prompt content*
(`TICKETING_FORMAT`, `TODO_FORMAT` from `prompts.generated.js`) still teaches the shapes the code
depends on. That second group is the interesting one: it is a contract test between generated
prompt text and the parsing rules in `tickets.ts` / `todo-loop.ts` — the format spec travels in the
system channel (#1163) rather than being materialized in the repo, so nothing else would notice if
the wording drifted away from what the code assumes.

All tests are synchronous, so there is no missing-await hazard anywhere in the file.

What is pinned:

- the two constants;
- that the ticket format still names `tickets/<DATE>_<SLUG>.md`, its `.plan.md` and `.lock.md`
  siblings, `Priority: 0-10`, `Topics:`, `GitHub:`;
- that the backlog format still names `TODO_AGENTS.md`, carries `## Priority 10 (critical`,
  `## Priority 9`, `## Priority 0 (only if capacity)`, and says both "Priority 10 is rarely used"
  and "sorted by priority";
- the seven priority-translation cases, including the two the SPEC argues about (out-of-range and
  fractional land in the middle rather than being clamped);
- `planTicketPrompt`'s exact sentence **and** the cross-check that its output is not read back as a
  queued ticket — the one assertion in the file that couples two functions, and the one that would
  catch a future "make plan entries link the ticket" change silently turning plan asks into
  implementation entries;
- `ticketFromQueueEntry` on a real link, plain text, and a non-ticket link;
- `isTicketPath`'s eight rejections, including a traversal dressed as a markdown link;
- `ticketIssueRef`'s URL-beats-label rule, the hand-written fallback, and the two `undefined` cases.

## Functions (low-level)

### L14 `the flat backlog lives at the root TODO_AGENTS.md`

Two equality assertions on constants. Trivially correct; guards a rename.

### L19 `the ticket-format spec ships in the package`

Six `assert.ok(...includes(...))` checks against `TICKETING_FORMAT`. These are substring checks, so
they cannot detect a *restructured* format that still contains the substrings — but they do catch
the failure mode they exist for (the format losing a field the code reads). The `Priority: 0-10`
check is the one that backs `todoPriorityForTicket`'s "a number is taken at its word" rule.

### L32 `the backlog-format spec ships in the package`

Same shape against `TODO_FORMAT`. The loop over three section headings gives a per-section failure
message. Note it checks `'## Priority 10 (critical'` and `'## Priority 0 (only if capacity)'` with
parenthetical text but `'## Priority 9'` bare — deliberate, since only the two ends carry reserved
meanings. Correct.

### L44 `a ticket priority maps onto the backlog format's numbered sections`

Seven cases. Every one is a distinct branch of `todoPriorityForTicket`: in-range, padded in-range,
absent, two word spellings, out-of-range, fractional. Real assertions; each would fail if the
regex or the range check changed. Correct.

### L59 `planTicketPrompt is the one plan ask`

Exact-string assertion plus the `ticketFromQueueEntry` cross-check described above. Correct.

### L68 `ticketFromQueueEntry reads the ticket a queued entry links back to`

Three cases: a ticket link, plain text, a non-ticket link. Correct. (Not covered: an entry with a
non-ticket link *before* a ticket link, which the implementation would report as no ticket. The
write side never produces that ordering.)

### L76 `only a plain file inside tickets/ counts as a ticket path`

One positive plus an eight-case rejection loop with a per-case message, then the link-level
traversal check. This is the security-relevant test in the file and it covers the gate's whole
surface except a backslash-separated path (`tickets/..\x.md`), which the implementation would
accept — harmless, since the value is used as a POSIX repo-relative path. Correct.

### L96 `ticketIssueRef reads the issue off the GitHub header line, URL first`

Five cases, including the disagreeing-label case that pins the "URL is the identity" rule and the
`GitHub: none yet` case that pins "a header naming no number fixes nothing". Correct.

## Bugs found

None found.
