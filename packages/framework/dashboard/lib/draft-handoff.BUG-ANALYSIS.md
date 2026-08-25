# Bug analysis: packages/framework/dashboard/lib/draft-handoff.ts

## Business logic (high-level)

Carries a draft prompt to the launcher without leaving it in the address bar (draft-handoff.SPEC).
Two producers — the device hop's `?draft=` URL param (stashed and stripped at SPA boot) and
in-app navigations (stashed directly) — one consumer (`takePendingDraft`, read-once).

Security/privacy audit (the file's raison d'être):

- `stashDraftFromUrl` moves the param into `sessionStorage` and `history.replaceState`s the URL
  *without* the draft — replace, not push, so neither history nor a later Referer carries it.
  The rebuilt URL keeps pathname + remaining search + hash (the test pins `keep=1` surviving).
  Correct. (The initial document request itself carried the param to the daemon — same-origin,
  unavoidable for a URL hand-off, and the daemon is the trusted party; consistent with the #1051
  bootstrap design.)
- `sessionStorage`, not localStorage: per-tab, dies with the tab — the right scope for a
  one-shot draft. Read-once semantics: `takePendingDraft` removes before returning, so a reload
  cannot re-seed (SPEC bullet 4; test-pinned).
- The `session()` try/catch covers storage-disabled browsers and non-browser loads; every entry
  point degrades to a no-op / null rather than throwing.

Edge cases: empty `?draft=` stores `''`; `takePendingDraft` returns `''` which consumers treat as
falsy (no seeding) — harmless. Repeated `draft` params: `get` takes the first, `delete` removes
all — no leftover. `stashPendingDraft` overwrites an untaken prior draft — last writer wins,
which is the sensible rule for "what the launcher should open with". Two tabs never share state
(sessionStorage is per-tab), so no cross-tab race exists.

Ordering reliance: `stashDraftFromUrl` must run at boot *before* any router code reads/normalizes
location — it is called from SPA bootstrap (main.tsx) by design; the launcher then pulls via
`takePendingDraft`. Consistent with the #1066/#1139 flow described in PromptEditor's
`initialText` docs.

## Functions (low-level)

- `session()` — guarded accessor. Correct.
- `stashDraftFromUrl()` — window guard, URL parse, param move + strip. Correct.
- `stashPendingDraft(draft)` — direct write. Correct.
- `takePendingDraft()` — read-and-clear; returns null when storage absent. Correct.

## Bugs found

None found.
