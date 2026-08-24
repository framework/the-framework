# Bug analysis: packages/framework/dashboard/components/Markdown.test.tsx

## Business logic (high-level)

Pins the three areas its test SPEC names.

Tables (#869): a separated pipe run renders a real `table` with `columnheader`/`cell` roles;
pipes without the separator stay prose (asserted both by the absent table role and the literal
line rendering); a short row pads to the header width (`getAllByRole('cell')` length 2 for one
`| only |` row under a 2-column header — pinning the `cells[c] ?? ''` padding).

Links (#948): `[text](url)` produces an anchor with the exact href and `rel` containing
`noreferrer` (the no-referrer-leak claim); a bare URL autolinks; `javascript:` yields *no link at
all* (queryByRole null — the strongest possible form of the safety assertion available at this
level); a URL inside backticks renders as literal code with no link.

Compact: body carries `text-xs`; an `# heading` is `text-sm` compact vs `text-lg` full — a real
comparative assertion, not just a class-presence smoke test.

Test hygiene: pure component, no mocks; synchronous renders; `cleanup` between tests; the
mid-test `unmount()` in the heading comparison prevents the two `Section` nodes from colliding.
Every assertion is falsifiable (e.g. the prose-not-table test would fail if the separator rule
loosened incorrectly to accept `| in prose |`).

Coverage gaps (not bugs): headings/lists/task-lists/bold/italic/fences are exercised indirectly
elsewhere (EventList tests pin bold) but not here; and no test covers GFM-minimal separators like
`:-:`/`--` — which is precisely where the source bug found in `Markdown.tsx` L40 lives, so the
suite cannot catch it. Worth adding a case alongside that fix.

## Functions (low-level)

- Table tests: fixtures use `---` separators (the one shape the source accepts); assertions via
  ARIA roles are resilient to class churn. Correct.
- Link tests: exact-href, rel, autolink, javascript:-rejection, backtick-literal. Correct.
- Compact tests: class-level assertions matched to the source's size ladders. Correct.

## Bugs found

None found. (The missing GFM-minimal-separator case is a coverage gap recorded above; the defect
itself is filed against `Markdown.tsx` L40.)
