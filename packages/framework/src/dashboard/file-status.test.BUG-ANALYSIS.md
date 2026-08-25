# Bug analysis: packages/framework/src/dashboard/file-status.test.ts

## Business logic (high-level)

Two tests over `readFileStatuses`, both with an injected `git` — right, since the mapping from
porcelain codes to the tree's three dot states is the whole behaviour and a real repo would add
nothing but setup.

What is pinned:

- The four interesting code shapes in one fixture: `' M'` (worktree modification), `'??'` (untracked),
  `' D'` (deleted), `'A '` (staged add → modified), and `'R '` with an arrow (rename → the **new**
  path is the key). The `deepEqual` covers the whole map, so an extra or missing entry fails.
- A git that throws yields `{}` rather than propagating — the forgiveness the panel depends on.

**Do the tests verify what they claim?** Yes. The rename case is the one that could silently regress
into keying on the old path or on the whole `old -> new` string, and the expected map names
`src/renamed.ts` explicitly with a comment saying why.

**What is not covered** (gaps, not defects): the double-column codes `'MM'`/`'AD'`/`'DD'`; a quoted
path (`"caf\303\251.ts"`), which is where `unquotePath`'s documented limitation lives; a completely
empty output (implicitly covered by the throwing test, but not directly); and `parsePorcelain` as an
exported function in its own right, even though `agent-handoff.ts` is a second consumer of it. That
last one is the notable gap: the parser is shared precisely so the two consumers cannot drift, and
nothing tests it independently of this mapping.

## Functions (low-level)

### `fakeGit(out)` (L5)

`(out: string) => async () => out` — ignores arguments entirely. Acceptable here: neither test cares
what git was asked, only what it answered. It does mean the tests cannot notice if the command ever
changed away from `status --porcelain` (e.g. to `--porcelain=v2`, whose grammar this parser would
mis-read). A gap worth knowing about, not a defect in the test as written.

### `'readFileStatuses maps porcelain codes to untracked/modified/deleted'` (L7)

Five input lines, one `deepEqual` over the full result. Each line exercises a distinct branch of the
mapping expression:
- `' M src/a.ts'` → not `??`, no `D` → modified.
- `'?? src/new.ts'` → untracked (and this is the branch that must be tested *before* the `D` test).
- `' D src/gone.ts'` → deleted.
- `'A  src/added.ts'` → note the two spaces: `slice(3)` therefore yields `src/added.ts` cleanly, which
  quietly pins the fixed-column assumption.
- `'R  old.ts -> src/renamed.ts'` → the arrow split, keyed on the new path.

*Verdict:* correct.

### `'readFileStatuses yields {} when git fails (not a repo)'` (L19)

A runner that throws; asserts `{}`. This is the assertion that would fail if the `.catch(() => '')`
were dropped — the call would reject and the test would error rather than compare. *Verdict:* correct.

## Bugs found

None found.
