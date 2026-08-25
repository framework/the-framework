# Bug analysis: packages/framework/src/dashboard/queue.ts

## Business logic (high-level)

The cross-project Queue (#438): parses markdown list items out of each project's surfaced `TODO*` docs and rolls them up per project. The load-bearing invariant (#1296) is that this parser and the daemon's queue-draining sweep (`parseTodoEntries` in todo-loop.ts) agree on what an *open entry* is — otherwise the card says "Nothing queued" while the sweep drains the same file. Verified against todo-loop.ts line by line:

- both accept `-`/`*`/`1.` markers at any indent (`LIST_ITEM` here demands trailing non-space via `(.*\S)`; the sweep captures `(.*)` then trims — same accepted set);
- both treat a leading `[ ]`/`[x]`/`[X]` checkbox as state, anything else (including ticket links `[Title](tickets/x.md)`, whose bracket content is multi-char and thus not a checkbox) as an open bare entry — the #1164 style that the old checkbox-only regex misread as empty;
- both drop entries empty after the checkbox. Difference by design: the sweep returns only open entries; this parser returns done ones too (`done: true`) so the dashboard can show totals — the *open* subsets are identical (pinned by the cross-parser test).

Shared quirk, deliberately consistent: an entry whose leading link title is a single ` `, `x` or `X` (`- [x](tickets/x.md) …`) parses as a checked checkbox in both parsers — agreement is the requirement, so not a divergence.

Rollup rules: `TODO*` docs matched by basename (so `tickets/TODO.md`, the #629 location, counts), items flattened across a project's TODO docs, projects with no items omitted, per-project read failures skipped, ordered most-open first (stable sort → registry order on ties).

## Functions (low-level)

- **`parseTodoItems(content)`** — splits on `\n` (a `\r\n` file would leave `\r`… no: `(.*\S)\s*$` strips trailing whitespace including `\r`, and for checkbox entries `task[2]!.trim()` strips it — CRLF-safe). Headings/prose/blank lines skipped by `LIST_ITEM` failing. `- [ ]` (empty open box) dropped and excluded from `total` (same as the sweep, and the SPEC's "empty after the checkbox is dropped"). Sub-items at deeper indent count as entries — "any indentation" is specced and matches the sweep. Verdict: correct.
- **`collectQueue(projects, read)`** — sequential per-project read with `.catch(() => [])`; filter `basename(d.name).startsWith('TODO')` (case-sensitive — `todo.md` ignored; the surfaced-docs convention is uppercase, matching `readDocs`'s TODO half); `open`/`total` computed from the parsed items; sort `b.open - a.open`. Verdict: correct.

## Bugs found

None found.
