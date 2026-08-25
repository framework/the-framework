# Bug analysis: packages/framework/src/todo-loop.ts

## Business logic (high-level)

Two things live here: the **queue document grammar** (parse open entries, insert one at a priority,
check one off) and the **backlog loop** that drives an agent through the queue one entry per turn.
Since #1582 the queue is `TODO_AGENTS.md` on the *data branch*, never a checkout file, and every
edit rides `withDataBranch`'s write cycle.

Responsibilities and invariants, checked against `todo-loop.SPEC.md`:

- **One grammar, three readers.** `parseTodoEntries`, `checkOffEntry` and `insertTodoEntry` must
  agree on what an "open entry" is, otherwise the loop can re-serve an entry it believes it
  retired. The two regexes are deliberately near-identical; the check-off regex additionally makes
  the checkbox optional so a bare bullet gains a checked one.
- **File order is priority order.** Headings are skipped by the parser, so a priority-sorted file
  drains top-down with no parser support. That is why `insertTodoEntry`'s placement *is* the
  priority: the drain preset works "the FIRST open entry".
- **The framework, not the agent, checks entries off.** The agent's checkout does not hold the data
  branch, so the prompt explicitly tells it not to touch the queue.
- **Bounded and unattended-safe.** Abort signal checked before each entry, hard item cap (default
  25), and two consecutive failed check-offs stop the loop rather than re-work the entry.
- **Never throws on the write paths.** `queueWrite` resolves `undefined` instead of rejecting;
  `appendTodoEntry` runs while an agent is already unwinding and must not mask why it stopped.

Concurrency/ordering: each iteration re-reads the queue `fresh` (a fetch first), so another
machine's check-off is seen before the next entry is picked. `checkOffEntry` is a no-op when the
entry is already checked or gone, and `withDataBranch` then commits nothing — the loop treats that
as landed, which is the correct reading of "someone else retired it meanwhile".

One residual, unproven hazard worth recording: `queueWrite` reports success whenever the funnel
cycle succeeded, *including* when the pure edit changed nothing. If a check-off ever failed to match
its line for a reason other than "already checked / already gone" — the line reworded by a
concurrent writer between the fresh read and the funnel's own re-read — the loop would believe the
entry retired, re-read it as `entries[0]`, and re-work it until the item cap. Nothing in this repo
rewords queue lines (the queue's only writers are this module and the dashboard's append), so this
is a reliance rather than a defect, but it is the one way the "re-doing finished work is worse than
stopping" guarantee at L400-403 can be defeated.

A second, benign asymmetry: `withDataBranch` returns `{ok:false, committed:true}` when the commit
landed but the push did not. `queueWrite` maps that to `undefined`, so the loop reports `stalled`
even though the entry *was* retired locally. That errs on the safe side (it stops rather than
re-works) and matches "an edit that could not land reports so", but it is the opposite of
`ticket-locks.ts`'s explicit "a commit that could not push still counts" rule. Worth knowing; not
a defect against this SPEC.

## Functions (low-level)

### `parseTodoEntries(md)` (L38)

Returns the open entries in file order. `/^\s*(?:[-*]|\d+\.)\s+(.*)$/` requires whitespace after the
bullet, so `---` (an hrule) and `*emphasis*` are not items. An empty item text is dropped. A task
checkbox is read with `/^\[([ xX])\]\s*(.*)$/`; `[x]`/`[X]` are skipped as done, `[ ]` with empty
text is dropped. Headings, prose and blanks fall out naturally. Fenced code blocks are not
tracked, but every consumer of the queue shares that blindness. Verdict: correct.

### `appendTodoEntry(cwd, entry)` (L65)

Plain tail append with a newline-separator guard for a file that does not end in `\n`. Empty file →
no leading blank. Verdict: correct.

### `appendFlatTodoEntry(cwd, entry, priority?)` (L79)

Delegates to `insertTodoEntry` when a priority is given, else the same tail append. Verdict:
correct.

### `queueWrite(cwd, message, edit)` (L97)

Resolves the project root (works from an agent worktree — pinned by a test that adds a real
worktree), then applies `edit` to `TODO_AGENTS.md` inside the data checkout, creating it from `''`
when absent. Returns the filename on `result.ok`, else `undefined`. `dataProjectRoot` failures and
the funnel's own failures are both non-throwing. Verdict: correct (see the committed-but-unpushed
note above).

### `insertTodoEntry(md, entry, priority)` (L132)

Pure placement. Four branches, all reachable and all pinned by tests:

1. **Existing section** — inserts after the section's last non-blank line, so arrival order is kept
   within a priority and the entry does not land after the section's trailing blank. The backward
   scan is bounded by `end > existing.index + 1`, so an *empty* section puts the item directly
   under its heading. Correct.
2. **Before the first lower section** — `headings.find(h => h.priority < priority)` relies on the
   file being sorted high→low, which the format guarantees. On an unsorted file the placement is
   still deterministic, just not globally sorted; not a defect.
3. **After every section when all outrank it** — same trailing-blank backward scan, then a blank
   plus the three-line section. Note `last` is the last *priority* heading; a trailing non-priority
   `## Notes` section correctly bounds the insertion.
4. **No priority sections** — above the file's first `##` heading (so a deliberate pick is not
   buried under unranked sections), or a plain tail when the file has no `##` heading at all.

`PRIORITY_HEADING`/`SECTION_HEADING` both require whitespace after `##`, so `###` sub-headings are
neither priority sections nor section boundaries — consistent between the two regexes. `Number(...)`
of a missing capture is `NaN` and is filtered by `Number.isFinite`. Verdict: correct.

### `checkOffEntry(md, entry)` (L179)

Maps every line; rewrites only a list item whose trimmed text equals `entry` and that is not already
checked. Rewrites as `${indent+bullet}[x] ${text}`, normalising spacing. Already-checked and absent
entries are no-ops (both pinned). A queue containing the *same* entry text twice would check off
both — harmless duplication of an idempotent action. Verdict: correct.

### `findTodoBacklog(cwd, opts)` (L200)

Reads `TODO_AGENTS.md` off the data branch (never a checkout copy) and returns `undefined` for a
missing file *or* one with no open entry. `fresh` fetches first. Verdict: correct.

### `agentTodoPending(cwd, sessionName)` (L221)

Session-scoped file only, guarded by `/^[A-Za-z0-9._-]+$/` so nothing with a path separator can
name a file. `.` is allowed, so `'..'` would build `TODO_...agent.md` — still a single filename
component inside `cwd`, so no traversal. Missing/unreadable file → `false`. Verdict: correct
(explicitly a temporary safety belt, built to be deleted).

### `nextQueuedTicket(cwd)` (L241)

First open entry's linked ticket, or `undefined`. The JSDoc says "read from the project checkout"
but the code reads the data branch via `readDataFile` — stale wording only; the behaviour matches
the SPEC ("read off the data branch"). Verdict: correct.

### `ticketForPrompt(prompt, cwd, read)` (L259)

Gated on `drainsQueue(prompt)` (whitespace-insensitive), and `read(...).catch(() => undefined)` so a
failing read can never take the agent start down. Verdict: correct.

### `runTodoLoop(opts)` (L332)

Per iteration: abort check → fresh read → gate → prompt → check-off with one inline retry.

- Empty/absent queue at any iteration → `finishEmpty()`, which narrates only when work was done.
- The gate uses a distinct id per item (`todo-next`, then `todo-next-<i>`), so posted picks cannot
  be confused across items. On abort, `requestChoices` resolves the *recommended* option
  (`proceed`) rather than stopping — the loop then prompts an already-aborted session, whose turn
  ends immediately, and the next iteration's abort check exits. Noisy but harmless.
- `completed++` happens after the turn and before the check-off, so a stalled or session-stopping
  item is still counted as worked — which is what the field documents ("entries worked (turns
  taken), regardless of outcome").
- `rounds.stopped` (a stop-marked answer, #358) returns `sessionStopped: true` and leaves the entry
  open, so a declined plan is not published *and* not lost.
- The retry loop runs `MAX_STALLS = 2` attempts on the same entry, matching the SPEC's "retrying
  once inline".
- Post-loop: abort → `stopped` without narration; else a non-fresh re-read decides `empty` vs
  `max-items`. The non-fresh read is fine because this machine's own funnel just committed into the
  data checkout.
- Verdict: correct.

## Bugs found

None found.
