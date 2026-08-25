# Bug analysis: packages/framework/src/dashboard/interventions-discord.test.ts

## Business logic (high-level)

Covers the Discord *phrasing* half of `interventions.ts` — `postInterventionsDiscord` and, through
it, `interventionLine` — with an injected `fetch` that captures the POST body. Split from
`interventions.test.ts` so the projection tests and the notification-copy tests do not share fixtures.

What it pins, per `interventions-discord.test.SPEC.md`:

- A single `pr` item is announced with number, project name and url.
- An `awaiting` item reads with its question, "awaiting your answer" and the dashboard link, and
  **never** a PR number.
- An `unpushed` item names the task, the commit count, the branch and "never pushed", again never a
  PR number, with `1 commit` in the singular.
- Several items are summarised under an "N items need you" count.
- An empty batch performs no POST at all.

**Does it verify what it claims?** Yes. Every test awaits, every assertion reads the captured body
rather than the return value alone, and the two `doesNotMatch(/#undefined/)` assertions are the real
guard: `interventionLine`'s `pr` shape is the *fallthrough* branch, so a kind that lost its own
branch would render `#undefined <title>` and only these assertions would catch it.

**Failure-mode coverage.** These tests never exercise a non-ok response or a network error — that is
`discord-webhook.test.ts`'s job, and the split is correct (the transport is shared). Nor do they
assert the *return* value of `postInterventionsDiscord`; `:50` infers delivery indirectly from the
call count. Since the transport tests cover the boolean, this is not a gap worth reporting.

**Ordering/concurrency:** none — the function is pure formatting plus one awaited POST.

## Functions (low-level)

### `item(n, url, project)` (L6)

Builds a `pr` intervention with no `createdAt`. Ordering is not under test here, so the omission is
fine.

### `'posts one item with its number, title, project and url'` (L15)

Asserts `/#285/`, `/gemstack/` and the escaped url against the captured content. Note `/gemstack/`
matches the "Needs you (gemstack)" prefix, which only the single-item branch emits — so this test
does discriminate the single-item shape from the bulleted one. *Verdict:* correct.

### `'phrases a paused-run item as awaiting, with no PR number (#636)'` (L28)

Four assertions covering the whole `awaiting` line plus the negative. `assert.match(content, /Cache the auth store\?/)`
correctly escapes the `?`. *Verdict:* correct.

### `'summarizes multiple items and skips the call when there are none'` (L50)

Two behaviours in one test: the `2 items need you` header, and that an empty batch adds no second
entry to `calls`. The second half is the meaningful one — a regression that POSTed an empty message
would make `calls.length === 2` and fail. *Verdict:* correct.

### `'names the branch for unpushed work, not a PR number (#860)'` (L62)

Asserts all four fragments of the `unpushed` line plus the `#undefined` negative with an explanatory
message. *Verdict:* correct.

### `'says "1 commit" rather than "1 commits" (#860)'` (L94)

`assert.match(content, /1 commit(?!s)/)`. The negative lookahead is what makes this test able to
fail: without it, `1 commits` would also match `/1 commit/`. Verified by hand — against the string
`"t — 1 commits on b, never pushed"` the regex has no match, because the only `1 commit` occurrence
is followed by `s`. Against `"t — 1 commit on b, never pushed"` it matches. *Verdict:* correct — a
rare case of a lookahead genuinely earning its place in a test.

Note the fixture at L103 passes `url: ''`, which also silently exercises the "no link appended"
branch of `interventionLine`; nothing asserts it, but nothing depends on it here either.

## Bugs found

None found.
