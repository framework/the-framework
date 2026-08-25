# Bug analysis: packages/framework/src/dashboard/tickets.ts

## Business logic (high-level)

Reads a project's `tickets/` for the dashboard, per `tickets.SPEC.md`:

- **What is a ticket**: every `.md` directly in `tickets/` except `*.plan.md`/`*.lock.md` siblings (`SIBLING` regex). `meta.json` and other non-`.md` files are excluded by the `.md` filter. No `tickets/` dir → `[]` (readdir catch). An unreadable ticket file is skipped (`content === undefined → continue`). All verified consistent with `hasTickets`.
- **Tolerant description** (`describe`): title = first `# ` line; preamble keys (`priority:`, `topics:`, `github:`, case-insensitive) read only from lines *above* the heading (no heading → no preamble → no keys, which matches "keys live above the title"); summary = first prose line after `## TLDR` (or after the heading, or from the whole file when neither exists), skipping blanks, `#`-prefixed lines, and `Source:` lines. CRLF content works because every extracted value is `.trim()`ed and the `startsWith` probes are prefix-safe.
- **Dates**: filename `YYYY-MM-DD_` → midnight UTC; else mtime; else epoch (sorts last under the newest-first descending sort). ISO strings from both sources compare correctly lexicographically.
- **Planned/claimed**: `.plan.md` existence → planned + `Effort:`/`Uncertainty:` from its preamble (whole numbers 0-10 only, deliberately unclamped); `.lock.md` existence → locked, holder via `ticketLockHolder` (unreadable lock still locks). Matches SPEC and #1420 tests.
- **Meta**: `readTicketsMeta` collapses every failure (missing, unreadable, >10KB truncation breaking the parse, non-object, non-string or unparseable stamp) to `{}`.
- **Path safety**: `isTicketFile` requires a bare `[^/\\]+\.md` name and non-sibling; `readTicket` refuses everything else — pins traversal (`../thing.md`, `/etc/passwd.md`, `sub/x.md`) to null.

Edge cases examined without finding intent violations:

- `readTickets` reads the *whole* file then slices to 4KB for `describe` — the "only the head is read" claim is about parsing, not I/O; a perf nit only.
- `readTicket` runs `describe(content)` uncapped while the list caps at 4KB — a ticket whose heading sits beyond 4KB would show a filename-title in the list but a real title on its page. Cosmetic inconsistency on absurd input; not reported.
- A ticket whose first body line is `---` (import horizontal rule) becomes the summary — tolerant-parser cosmetics.
- `titleFromFile` decodes percent escapes and falls back on a stray `%` (`1-100%_sure` case, pinned by tests).
- Concurrent modification between `readdir` and the `readFile`s: a ticket deleted mid-listing is skipped via the readFile catch; a sibling created mid-listing is missed for one poll. Acceptable for a polled view.
- `planScale` finds `Effort:`/`Uncertainty:` case-insensitively and slices by key length (works because the match guarantees the prefix length); `/^\d+$/` rejects negatives/fractions/`+` signs; range check 0-10. Matches SPEC's "not clamped".

## Functions (low-level)

- **`hasTickets(cwd)`** — readdir-only presence probe; agrees with `readTickets` on siblings and non-md files (pinned by tests). Correct.
- **`readTicketsMeta(cwd)`** — described above; the `MAX_META_BYTES` slice happens after the full read (the "cannot be read whole" comment slightly overstates), but a >10KB junk file still lands on `{}` via the parse failure. Correct.
- **`titleFromFile(file)`** — decode + de-underscore with a raw fallback. Correct.
- **`describe(md)`** — described above. Correct.
- **`dateFromFilename(file)` / `fileDate(path)` / `ticketDate(dir, file)`** — filename date wins; stat-failure → epoch. `Date` validity of the filename digits is not checked (`2026-99-99` would produce an unparseable ISO string that still sorts) — garbage-in tolerated, not shown as a crash. Correct.
- **`planScale(preamble, key)` / `planMeta(md)`** — plan preamble = lines above the first `# `; a plan with no heading treats the whole (4KB-capped) file as preamble — slightly generous but consistent with tolerance. Correct.
- **`readSibling(dir, name, siblings)` / `readLock(dir, name, siblings)`** — existence from the readdir set, content best-effort; a sibling present in the set but deleted before the read still reports `real: true`/`locked: true` with no content — the existence-is-the-claim rule, applied to a race window. Correct.
- **`readTickets(cwd)`** — assembles rows; skips siblings as rows; newest-first sort. Correct.
- **`isTicketFile(file)`** — bare-name regex + sibling exclusion; `.md` alone does not match (needs ≥1 leading char). Correct.
- **`readTicket(cwd, file)`** — guard first, then full read; sibling set from a fresh readdir. Correct.

## Bugs found

None found.
