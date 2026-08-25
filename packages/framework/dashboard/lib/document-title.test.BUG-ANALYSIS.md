# Bug analysis: packages/framework/dashboard/lib/document-title.test.ts

## Business logic (high-level)

Pins `frameworkTitle`'s composition: bare brand with nothing to say (both `undefined` and `null`
project), count prefix alone, project scope alone, both combined, and the count dropping at zero.
Exact-string assertions (`toBe`), so any wording/spacing drift — including the em-dash separator
and the space after `(n)` — fails loudly. The five cases cover the full 2×2 input matrix plus the
null variant; the test titles say exactly what each asserts and the assertions match.

Not covered: `useDocumentTitle` (the effect writing `document.title`). The hook is four lines
around the pure function and the interesting logic is all in `frameworkTitle`; a jsdom renderHook
test would add little. Gap noted, not a bug.

## Functions (low-level)

- No helpers; each `it` is a direct call + `toBe`. Nothing that could pass vacuously. Correct.

## Bugs found

None found.
