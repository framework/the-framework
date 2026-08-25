# Bug analysis: packages/framework/src/dashboard/queue.test.ts

## Business logic (high-level)

Pins the queue parser and rollup per its test SPEC: checklist extraction with ticked state at any indent/marker while headings, prose and empty boxes are ignored; the #1296 regression (ticket-link entries with no checkbox are open work, so a triage-written queue is not "Nothing queued"); rollup counts open/total per project, orders most-open first, omits projects with no TODO doc/no items/unreadable docs; `TODO*` recognized by basename wherever it lives (`tickets/TODO.md`).

The strongest test is the last one: it imports the sweep's real `parseTodoEntries` and asserts, item for item, that this parser's open subset equals the sweep's — the exact drift the SPEC calls out as the bug class. That is a genuine agreement test, not a tautology (two independent implementations compared on shared input).

## Functions (low-level)

- **"parseTodoItems extracts task-list entries and their checked state"** — mixes `- [ ]`, `* [x]`, indented `- [X]`, prose, and an empty `- [ ]`; `deepEqual` on the full item list (so the empty-box drop is pinned by omission from the expected array). Correct.
- **"collectQueue rolls up open TODO items per project, most-open first, skipping empties"** — four projects covering: nested-path TODO (basename match), a `TODO_main.agent.md` prefix match, a `PLAN.md`-only project (skipped), and a TODO with no items (skipped); asserts id/open/total triples in order. Correct.
- **"collectQueue skips a project whose docs read throws"** — `/boom` rejects; asserts `['ok']`. Correct.
- **"link-style entries with no checkbox are open items (#1296)"** — a realistic triage-written document with priority headings, a wrapped continuation line (proving it is not an entry), a checked entry and prose; asserts `[done, text-prefix]` pairs. Correct.
- **"parseTodoItems agrees with the sweep parser (#1296)"** — dynamic import of `../todo-loop.js`, input covering link entries, open/checked boxes, star/numbered markers, a continuation line, a heading; `deepEqual(openSubset, parseTodoEntries(md))`. Can fail on any divergence in either direction. Correct.

Coverage note (not a bug): sort stability on tied `open` counts and the CRLF case are unasserted.

## Bugs found

None found.
