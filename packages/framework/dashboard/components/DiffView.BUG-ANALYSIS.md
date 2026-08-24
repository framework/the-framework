# Bug analysis: packages/framework/dashboard/components/DiffView.tsx

## Business logic (high-level)

The one file rendering (#816/#817/#828): `DiffView` colors a unified git patch line-by-line,
`ContentView` shows an unchanged file with line numbers, `DiffStat` the `+12 −3` pair, plus the
shared `Cut` ("Cut here. The rest is in the worktree.") and `Binary` notes. Deliberately plain (no
syntax highlighting, read-only) per SPEC. Both viewers scroll inside `overflow-auto`.

Checked against `DiffView.SPEC.md`:

- Binary → the one-line note; empty file → "Empty file."; truncated → identical Cut wording for
  diff and content. All present.
- DiffStat renders only the non-zero halves (and the space only when both) — 0/0 renders an empty
  span. Matches SPEC.
- Line classification is a per-line prefix heuristic — see Bugs for where it misfires.
- `line || ' '` keeps empty lines from collapsing; index keys fine for static content; a patch's
  trailing newline yields one trailing blank row (cosmetic); a "\ No newline at end of file"
  marker renders plain muted — fine.

## Functions (low-level)

### `Cut()` / `Binary()` (L13–20)

Static copy, shared so the wording cannot drift. Correct.

### `DiffStat({ added, removed })` (L23–31)

Conditional halves, separator space only when both, `−` (minus sign) for removed. Correct.

### `lineClass(line)` (L33–40)

Prefix rules in order: `+++`/`---` → muted (file headers), `@@` → primary, `+` → added, `-` →
removed, else plain. The header rule outranks the add/remove rules by ordering, which is what
creates the misclassification in Bugs #1. `@@` only occurs as hunk headers in git output, and a
context line starting with a space never collides. Verdict: bug found (edge lines).

### `DiffView({ diff })` (L42–54)

Binary short-circuit, split on `\n`, per-line class, Cut when truncated. Correct apart from the
lineClass issue.

### `ContentView({ content })` (L58–76)

Binary → note; empty text → "Empty file."; otherwise numbered lines with a gutter sized
`digits+1ch` (right-aligned, `select-none` so copying the body does not drag numbers along).
Off-by-one checked: `i + 1` numbering, width from `lines.length` — correct. A trailing newline
produces a final empty numbered line — faithful to the bytes. Correct.

## Bugs found

1. `L34`: any *added* line whose content begins with `++` and any *removed* line whose content
   begins with `--` is misrendered as a muted file header instead of a green/red change line,
   because the `+++`/`---` check runs first on bare prefixes. Concrete scenario: a diff that adds
   the C/C++ line `++i;` produces the patch line `+++i;` → shown muted, not as an addition; a diff
   removing the SQL comment `-- fetch users` produces `--- fetch users` → shown muted, not as a
   removal. The SPEC promises "added lines in green, removed lines in red"; here a real change
   line silently loses its coloring (the reader can miss a removed line entirely). Severity:
   minor (cosmetic-but-misleading, plausible content). Confidence: high (mechanism certain from
   the code; occurrence depends on file content). Fix sketch: recognize headers only in git's
   actual shapes, e.g. `/^(\+\+\+ |--- )(a\/|b\/|\/dev\/null)/` (or only before the first `@@`),
   before falling through to the `+`/`-` rules.
