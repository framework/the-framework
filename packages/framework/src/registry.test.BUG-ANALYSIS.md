# Bug analysis: packages/framework/src/registry.test.ts

## Business logic (high-level)

A thorough suite matching `registry.test.SPEC.md` section-for-section. The `memFs` fake is the load-bearing piece and models the real semantics that make the interesting properties observable:

- `write` **truncates before storing** and can be told to fail on one path (`failWritesTo`), which is what makes #991's atomicity falsifiable: were the live file written in place, the injected mid-write failure would leave it empty — and the test asserts the previous contents survive byte-identical.
- `read` throws on missing paths (like the node fs); `rename` moves contents **and mode**, so the "mode set on the temp before the rename" assertion (`modes` keys end up as exactly `[FILE]`) actually proves the no-window property rather than passing vacuously.
- `slow: true` inserts an await point inside read/write so concurrent mutators genuinely interleave — the serialization tests (`concurrent addProject`, `addProject + writePreferences`, two first-binds one token) would fail without the module-level queue.

Spot-checked the trickier expectations against the implementation:

- Path tests: XDG wins, empty XDG counts as unset; ids deterministic/distinct/URL-safe (including `ÜMLAUT`, spaces, parens).
- Read tests: missing/empty/garbage/non-object → `[]`; malformed records dropped; dedupe by resolved path first-wins (`/repos/app-a/` collapses); the pre-#410 bare-array shape reads as empty (zero-migration, per MEMORY.md).
- `addProject`: pretty JSON parses back; idempotent across `/`-suffixed and `..`-containing variants with `addedAt` preserved and nothing written; stored path absolute; preferences preserved.
- Preference validation: the `allOn` record is **typed over the boolean keys computed from `Preferences` itself**, so adding a boolean preference without extending the test is a compile error, and one missing from the sanitizer's table fails the round-trip — the two-layer #944 guard working as designed. Fixed-set prefs keep known values, drop junk; renamed legacy keys (`autoPushBranch`, `agent`) read as unknown; `Default`/blank model dropped; editor trimmed/blank-dropped; opt-out list trimmed/deduped/junk-dropped-itemwise with `[]` clearing the key; `autoPmProject` trimmed, not cross-checked against the project list (documented); spend offset round-trips, clamps at ±`MAX_SPEND_OFFSET`, drops NaN/strings; concurrency floors at 1, keeps 9000, rounds 2.6→3, drops NaN/strings; custom presets keep only well-formed entries and the field vanishes when none survive.
- Patch semantics (#1148): merge touches only named keys; blank-clears without sentinels; the merged result is sanitized as a whole (`theme: 'moon'` dropped *and* the unknown key never lands); the store's `patch` returns the stored merge.
- Listener (#1161): receives the written keys (`[{autoPm:true},{vanilla:true}]`), not the merge; a throwing listener does not fail the save.
- Atomicity (#991): live path never in `written`; only `*.tmp` paths written; temp renamed away (exactly one file left); failed write leaves the old registry intact; a rejected mutation does not wedge the queue (fresh healthy fs afterwards — correctly avoids reusing the poisoned one).
- Token (#1051): base64url charset, ≥43 chars, top-level (explicitly asserts `preferences.daemonToken === undefined`), reused not rotated, survives other mutators, absent until minted, junk shapes dropped; concurrent first-binds settle on one token.
- Secrets (#1095): round-trip at top level, patch leaves unmentioned keys, `null` clears, last-clear drops the block from the file (`'secrets' in parsed === false`), hand-edited junk sanitized, other sections preserved, chmod-less fs still writes, token survives.

Assertions are concrete (`deepEqual` on full objects, exact mode values, exact file contents); nothing can pass vacuously. All async calls awaited, including the `assert.rejects` cases.

## Functions (low-level)

- **`memFs(seed?, options?)`** — as above; `mkdir` records into `dirs` (asserted once: the dotfile's parent is `$HOME`). Faithful where it matters. Correct.
- **`ENV`/`FILE`/`APP_A`/`APP_B`** — fixed fixtures; `projectId` derived via the real function (so these tests pin behavior, not literals — acceptable since determinism/distinctness get their own direct tests).
- One residual coupling: tests run in one process sharing the module-level mutation queue — the wedge test deliberately proves that safe. Correct.

## Bugs found

None found.
