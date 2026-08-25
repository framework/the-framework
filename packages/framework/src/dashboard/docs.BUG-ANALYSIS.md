# Bug analysis: packages/framework/src/dashboard/docs.ts

## Business logic (high-level)

Reads the plan/backlog documents the dashboard's sidebar shows beside the agent. Two fixed
categories, in sidebar order:

1. **Plans** — the workspace-root `PLAN.md`, then every `PLAN_<slug>.agent.md` (sorted).
2. **Backlogs** — the agent queue `TODO_AGENTS.md`, read *off the data branch* (#1582, so a stale
   working-tree copy never shadows it), then every `TODO_<slug>.agent.md` (sorted).

**Path safety.** The whole guard is that no name is ever taken from a caller: the flat names are
module constants and the scoped names are `readdir` entries filtered through `^(PLAN|TODO)_[a-z0-9-]+\.agent\.md$`.
Because `readdir` is non-recursive and returns bare basenames, an entry can contain neither a
separator nor `..` in the first place, and the regex is belt-and-braces. The session slug the system
prompt tells agents to invent is `[a-z0-9-]+` (see `prompts.generated.ts`'s `SYSTEM_PROMPT`), so the
pattern and the producer agree.

**Error containment.** Three independent failure paths, all handled: `readdir` failing (missing or
unreadable workspace) short-circuits to `[]`; each `readFile` is `.catch(() => undefined)`-ed;
`readDataFile` never rejects (every `git` call inside it is caught). So `readDocs` genuinely never
throws, as advertised.

**Ordering.** Sequential `await`s inside a `for` — one `readdir`, then up to N `readFile`s and one
data-branch read (which itself spawns `git rev-parse` and up to three `git show`s). All reads run on
a poll, so the git spawns are the expensive part; they are not cached here.

**Sizing.** `MAX_DOC_BYTES` caps what is *returned*, not what is read: the whole file is `readFile`-d
into memory before the slice. For the documents this surfaces (a plan, a backlog) that is fine;
Node's own `readFile` cap (~2 GiB) would reject anything pathological and the `.catch` would drop it.
The name says "bytes" but the cap is applied to `content.length`, i.e. UTF-16 code units — for
ASCII-ish markdown the two coincide.

**A note on `DOC_CATEGORIES[1].flat`.** The backlog category carries `flat: 'TODO_AGENTS.md'`, but
the code never reads it: the `'backlog' in cat` branch is taken first and pushes under
`FLAT_TODO_FILE` (which is the same string, from `tickets.ts`). It is live only as the thing
`docs.test.ts:85` asserts contains no separator. Redundant, not wrong.

**A stale comment.** The JSDoc block at L32-37 describes a function that no longer exists ("The
workspace-root filenames to surface…"); L38-43 is the real one for `readDocs`. Documentation debt
only.

## Functions (low-level)

### `DOC_CATEGORIES` (L18-21)

A readonly tuple of `{ flat, scoped }` (plus `backlog: true` on the second). `as const` is what makes
`'backlog' in cat` narrow correctly. The regexes are anchored on both ends and the slug class
excludes `.`, `/`, `\`, so `PLAN_../evil.agent.md` and `PLAN_a/b.agent.md` cannot match — verified by
`docs.test.ts:87-88`. *Verdict:* correct.

### `readDocs(cwd)` (L44-64)

*Input:* a workspace path. *Output:* `WorkspaceDoc[]` in sidebar order.

Edge cases:
- **`cwd` missing / not a directory** → `readdir` throws → `[]`. Correct (pinned at `docs.test.ts:76`).
- **`PLAN.md` present but unreadable** (EACCES, or it is a *directory* → EISDIR) → `.catch(() => undefined)`
  → `push` sees `undefined` → skipped. Correct.
- **Blank or whitespace-only content** → `!content?.trim()` drops it, so the sidebar shows no empty
  card. Correct, and the empty-string case is covered by the same check (an empty file would
  otherwise render as a doc with no body).
- **Data-branch backlog absent** → `readDataFile` resolves `undefined` → skipped. Correct.
- **A root `TODO_AGENTS.md` exists but the data branch also has one** → the root copy is never read at
  all; `present` is only consulted on the non-backlog branch. Correct, and this is the #1582 point
  pinned by `docs.test.ts:56`.
- **A root `TODO_AGENTS.md` exists and the data branch has none** → nothing is surfaced. That is
  intentional per the SPEC ("read off the data branch, its one location"), not an omission.
- **Duplicate names** — impossible: `readdir` entries are unique and the flat name cannot match the
  scoped regex (it lacks `.agent.md`).
- **Scoped ordering** — `entries.filter(...).sort()` is a default lexicographic sort of basenames.
  Deterministic across platforms, since `readdir` order is not relied on. Correct.
- **A `PLAN_*.agent.md` that is a directory** → `readFile` fails → skipped. Correct.
- **Truncation marker** — a doc over the cap is cut and gains `\n\n… (truncated)`, so a cut document
  never reads as complete. Correct. (The cut is by UTF-16 code unit, so it could in principle land
  between a surrogate pair and emit a lone surrogate; for markdown plans this is not a case that
  occurs, and the payload is JSON-encoded either way.)

*Verdict:* correct.

## Bugs found

None found.
