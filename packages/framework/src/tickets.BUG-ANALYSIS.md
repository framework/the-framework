# Bug analysis: packages/framework/src/tickets.ts

## Business logic (high-level)

A tiny leaf module holding the two repo conventions (`tickets/` and the root `TODO_AGENTS.md`) and
the four pure rules that link them: priority translation, the one plan-ask wording, the queue-entry
→ ticket link reader, and the ticket → GitHub issue reference reader. No I/O, no state, no
lifecycle — every function is total and side-effect free, so the only failure modes are wrong
parsing decisions.

Invariants worth checking, against `tickets.SPEC.md`:

- **`isTicketPath` is the single gate** for both link ends (queue-entry reading and the `--ticket`
  flag). Because the output is a path a reader opens and the dashboard renders, it must refuse
  traversal, absolutes, URLs, nesting, dotfiles, and non-`.md`.
- **Priority is taken at its word or falls to 5.** Out-of-range and fractional values deliberately
  are *not* clamped: clamping would hide a typo. Word spellings are no longer part of the format.
- **`planTicketPrompt` is the one wording**, so the plan column, the queued entry, and the dedupe
  that recognizes a queued copy all match by exact text.
- **URL beats label** in `ticketIssueRef`: the linked URL is the issue's identity, the bracket text
  is display.

## Functions (low-level)

### `TICKETS_DIR` (L8) / `FLAT_TODO_FILE` (L17)

Plain constants. Pinned by the test file. Correct.

### `todoPriorityForTicket(priority?)` (L45)

Input: the raw `priority:` value off a ticket (or `undefined`). Output: 0-10, default 5.

- `undefined`, `''`, `'high'`, `'2.5'`, `'-1'` (the `-` fails `^\d+$`), `'11'` → 5. All intended.
- `' 2 '` → 2 (trimmed first) — the SPEC calls out that the key is read verbatim off the ticket so
  it may be padded.
- `'007'` → 7 and `'0'` → 0 — both fine on this scale.
- Leading `+` or a unicode digit fails `\d` in a non-`u` regex the way intended (`\d` is ASCII-only
  in JS regardless of flags).
- Verdict: correct.

### `planTicketPrompt(file)` (L61)

`Create tickets/<stem>.plan.md`. `file` is a *bare* ticket filename everywhere it is called
(`dashboard-rpc/control.ts` L397 passes `QueuedTicket.file`, documented as "the ticket's filename
inside `tickets/`"), so the `TICKETS_DIR` prefix is added exactly once. A file without `.md` gets
`.plan.md` appended, which is harmless. Verdict: correct.

### `ticketFromQueueEntry(entry)` (L75)

Extracts the *first* markdown link target (`/\]\(([^)\s]+)\)/`) and returns it only if it passes
`isTicketPath`.

- A plain-text entry, or one linking `README.md`, → `undefined`.
- `planTicketPrompt(...)` output contains no link, so a queued plan ask is never mistaken for a
  queued ticket — the test pins this and it matters (a leading ticket link means "queued for
  implementation").
- Only the first link is considered: an entry whose first link is not a ticket but whose second is
  would report no ticket. The write side (#1164) always puts the ticket link first, so this is not
  reachable in practice — noted as a reliance, not a defect.
- The regex requires no whitespace inside the target, so a link with a percent-encoded space works
  and one with a literal space does not — matching the "a reader will go and open this" rule.
- Verdict: correct.

### `isTicketPath(path)` (L88)

Prefix `tickets/`, then the remainder must end in `.md`, contain no `/`, and not start with `.`.

- `tickets/../secrets.md` → remainder `../secrets.md` contains `/` → false.
- `tickets/nested/deep.md` → false. `tickets/.hidden.md` → false. `tickets/notes.txt` → false.
- `tickets/` → remainder `''` → `.endsWith('.md')` false → false.
- `tickets/.md` → starts with `.` → false.
- `/etc/passwd`, `https://…`, `TODO_AGENTS.md` → no prefix → false.
- Backslashes are not treated as separators, so `tickets/..\secrets.md` would pass — but this path
  is only ever used to build a POSIX repo-relative path and read through git, where `..\` is a
  literal filename character, so no traversal results.
- Verdict: correct.

### `ticketIssueRef(md)` (L104)

Finds the first line whose trimmed, lowercased form starts with `github:`, then prefers a URL-shaped
`(…/issues/N)` or `(…/pull/N)` capture over a bare `#N` on the same line.

- `GitHub: [#42](https://…/issues/42)` → `#42`; `GitHub: [gh-7](…/issues/99)` → `#99` (URL wins,
  as specified).
- `GitHub: #13` → `#13` via the fallback.
- `GitHub: none yet` and a ticket with no such line → `undefined`.
- The URL regex's `(?:[^)]*\/)?` makes the host optional, so a relative `(issues/42)` also matches.
- It matches the first `github:` line anywhere in the file, including inside a fenced code block or
  a quoted example. Ticket files put the header at the top, so the first match is the header;
  worth knowing but not a reachable defect.
- Verdict: correct.

## Bugs found

None found.
